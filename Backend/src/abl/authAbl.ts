import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import {
  createUserDao,
  findUserByEmailDao,
  findUserByGoogleIdDao,
  findUserByUsernameDao,
  createGoogleUserDao,
  linkGoogleIdDao,
} from "../dao/userDao.js";
import { parseOrThrow } from "./errors.js";

export class EmailAlreadyInUseError extends Error {}
export class InvalidCredentialsError extends Error {}
export class AccountBlockedError extends Error {}
// The token wasn't a valid, current Google ID token for this app — expired,
// forged, or minted for a different OAuth client than our own
// GOOGLE_CLIENT_ID. Deliberately one generic error for all of those: none
// of the specifics are actionable for the caller, and folding them together
// avoids leaking *why* verification failed to whatever sent the token.
export class GoogleTokenInvalidError extends Error {}

// MongoDB's `unique` index on `email` is case-sensitive, so without
// normalizing, "Alice@Test.com" and "alice@test.com" would pass the
// "already in use" check as two different accounts. Applied to both
// schemas — not just register's — because a lookup has to normalize the
// same way a write did, or login stops finding accounts it just created.
const normalizeEmail = (v: string) => v.trim().toLowerCase();

const registerSchema = z.object({
  username: z.string().min(1, "username is required"),
  // Normalize before validating format, not after — " Alice@Test.com " is a
  // valid email once trimmed, but `.email()` would reject the raw string.
  email: z
    .string()
    .min(1, "email is required")
    .transform(normalizeEmail)
    .pipe(z.string().email("must be a valid email")),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  email: z.string().min(1, "email is required").transform(normalizeEmail),
  password: z.string().min(1, "password is required"),
});

const googleAuthSchema = z.object({
  idToken: z.string().min(1, "idToken is required"),
});

const generateToken = (userId: string) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET as string, {
    expiresIn: "7d",
  });

// One client, reused across requests — verifyIdToken doesn't need a fresh
// instance per call, and the OAuth2Client constructor is what caches
// Google's public signing keys internally.
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// A brand-new Google sign-in has no username of its own to offer — derive
// one from the email's local part, falling back to a numbered variant only
// on an actual collision (the common case needs no suffix at all, so this
// doesn't tack on noise for the first person named e.g. "alice").
const usernameFromEmail = async (email: string): Promise<string> => {
  const base = email.split("@")[0].replace(/[^a-zA-Z0-9_-]/g, "") || "user";
  if (!(await findUserByUsernameDao(base))) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}${i}`;
    if (!(await findUserByUsernameDao(candidate))) return candidate;
  }
  // Astronomically unlikely (999 collisions on the same email prefix) — a
  // random suffix beats looping forever.
  return `${base}${Math.random().toString(36).slice(2, 8)}`;
};

export const registerAbl = async (input: unknown) => {
  const { username, email, password } = parseOrThrow(registerSchema, input);

  const existing = await findUserByEmailDao(email);
  if (existing) throw new EmailAlreadyInUseError();

  const user = await createUserDao({ username, email, password });
  const token = generateToken(user._id.toString());

  return { user, token };
};

export const loginAbl = async (input: unknown) => {
  const { email, password } = parseOrThrow(loginSchema, input);

  const user = await findUserByEmailDao(email);
  if (!user) throw new InvalidCredentialsError();

  // A Google-only account (see googleAuthAbl) has no passwordHash at all —
  // same outward error as a wrong password, so this doesn't leak "that
  // email exists but only signs in via Google" to anyone probing it.
  if (!user.passwordHash) throw new InvalidCredentialsError();

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) throw new InvalidCredentialsError();

  // Checked only after the password is confirmed correct — same reasoning as
  // `protect` re-checking on every request: a blocked user's credentials are
  // still theirs, we just refuse to hand out a session. Checking this before
  // the password match would leak "this account is blocked" to anyone who
  // merely guesses/knows the email, without proving they own it.
  if (user.isBlocked) throw new AccountBlockedError();

  const token = generateToken(user._id.toString());

  return { user, token };
};

// Registration and login by Google account collapse into this one entry
// point — same as a returning user typing their password back in, "sign in
// with Google" either finds the matching account or creates it on the spot,
// there's no separate "you must register first" step for it.
export const googleAuthAbl = async (input: unknown) => {
  const { idToken } = parseOrThrow(googleAuthSchema, input);

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw new GoogleTokenInvalidError();
  }
  // getPayload() can legitimately return undefined even on a token that
  // verified — an email-less Google account, in practice never seen in the
  // wild but part of its documented contract.
  if (!payload?.sub || !payload.email) throw new GoogleTokenInvalidError();

  const googleId = payload.sub;
  const email = normalizeEmail(payload.email);

  let user = await findUserByGoogleIdDao(googleId);

  if (!user) {
    const existingByEmail = await findUserByEmailDao(email);
    if (existingByEmail) {
      // Same person who already registered with a password — link this
      // Google account onto it rather than creating a second, separate one
      // that happens to share an email MongoDB's unique index would reject
      // anyway.
      user = await linkGoogleIdDao(existingByEmail._id.toString(), googleId);
    } else {
      const username = await usernameFromEmail(email);
      user = await createGoogleUserDao({ username, email, googleId });
    }
  }
  if (!user) throw new GoogleTokenInvalidError();

  // Same reasoning as loginAbl: checked only once the account is actually
  // resolved, never before, so a blocked user's Google identity can't be
  // used to fish for "is this account blocked?" either.
  if (user.isBlocked) throw new AccountBlockedError();

  const token = generateToken(user._id.toString());

  return { user, token };
};
