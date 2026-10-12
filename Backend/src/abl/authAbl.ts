import { z } from "zod";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import {
  createUserDao,
  findUserByEmailDao,
  findUserByGoogleIdDao,
  findUserByUsernameInsensitiveDao,
  setUsernameDao,
  createGoogleUserDao,
  createDemoUserDao,
  linkGoogleIdDao,
} from "../dao/userDao.js";
import { parseOrThrow } from "./errors.js";
import { createMapAbl } from "./mapAbl.js";

export class EmailAlreadyInUseError extends Error {}
export class InvalidCredentialsError extends Error {}
export class AccountBlockedError extends Error {}
// The token wasn't a valid, current Google ID token for this app — expired,
// forged, or minted for a different OAuth client than our own
// GOOGLE_CLIENT_ID. Deliberately one generic error for all of those: none
// of the specifics are actionable for the caller, and folding them together
// avoids leaking *why* verification failed to whatever sent the token.
export class GoogleTokenInvalidError extends Error {}
export class UsernameTakenError extends Error {}

// MongoDB's `unique` index on `email` is case-sensitive, so without
// normalizing, "Alice@Test.com" and "alice@test.com" would pass the
// "already in use" check as two different accounts. Applied to both
// schemas — not just register's — because a lookup has to normalize the
// same way a write did, or login stops finding accounts it just created.
const normalizeEmail = (v: string) => v.trim().toLowerCase();

// What a username may be: letters (any script, so a Google name like
// "Віктор" survives as-is), digits, spaces, and . _ - — enough for a real
// name, nothing that reads as markup or breaks a mention.
const USERNAME_CHARS = /^[\p{L}\p{N} ._-]+$/u;
const usernameSchema = z
  .string()
  .trim()
  .min(2, "Username must be at least 2 characters")
  .max(32, "Username must be at most 32 characters")
  .regex(USERNAME_CHARS, "Username may only use letters, numbers, spaces, and . _ -");

const registerSchema = z.object({
  // Optional: left blank, the account gets the email's part before the @
  // (see defaultUsername) and can change it later.
  username: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), usernameSchema.optional()),
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

// One client, reused across requests — verifyIdToken doesn't need a fresh
// instance per call, and the OAuth2Client constructor is what caches
// Google's public signing keys internally.
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Strips whatever a username can't hold and collapses spaces — "" when
// nothing usable is left (an all-emoji Google name, say).
const sanitizeUsername = (raw: string) =>
  raw
    .replace(/[^\p{L}\p{N} ._-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 28);

// The first free variant of `base` — the common case needs no suffix at
// all, so this doesn't tack on noise for the first person named "alice".
const uniqueUsername = async (base: string): Promise<string> => {
  if (!(await findUserByUsernameInsensitiveDao(base))) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}${i}`;
    if (!(await findUserByUsernameInsensitiveDao(candidate))) return candidate;
  }
  // Astronomically unlikely (999 collisions on the same base) — a random
  // suffix beats looping forever.
  return `${base}${Math.random().toString(36).slice(2, 8)}`;
};

// A username picked for someone who didn't type one: their Google profile
// name when there is one, otherwise their email up to the @.
export const defaultUsername = async ({ name, email }: { name?: string | null; email: string }) => {
  const fromName = sanitizeUsername(name ?? "");
  const fromEmail = sanitizeUsername(email.split("@")[0]);
  const base = fromName.length >= 2 ? fromName : fromEmail.length >= 2 ? fromEmail : "user";
  return uniqueUsername(base);
};

export const registerAbl = async (input: unknown) => {
  const { username, email, password } = parseOrThrow(registerSchema, input);

  const existing = await findUserByEmailDao(email);
  if (existing) throw new EmailAlreadyInUseError();

  let finalUsername: string;
  if (username) {
    if (await findUserByUsernameInsensitiveDao(username)) throw new UsernameTakenError();
    finalUsername = username;
  } else {
    finalUsername = await defaultUsername({ email });
  }

  const user = await createUserDao({ username: finalUsername, email, password });

  return { user };
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

  return { user };
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
      // Picked for them, so the frontend offers to change it once (see
      // User.usernameConfirmed).
      const username = await defaultUsername({ name: payload.name, email });
      user = await createGoogleUserDao({ username, email, googleId, usernameConfirmed: false });
    }
  }
  if (!user) throw new GoogleTokenInvalidError();

  // Same reasoning as loginAbl: checked only once the account is actually
  // resolved, never before, so a blocked user's Google identity can't be
  // used to fish for "is this account blocked?" either.
  if (user.isBlocked) throw new AccountBlockedError();

  return { user };
};

// Same accent orange used by index.css's own --accent — no color picker for
// a visitor who hasn't seen the app yet, so this just matches the app's own
// brand color rather than an arbitrary pick.
const DEMO_OWNER_COLOR = "#b5651d";

// "Try it without registering" — a real account and a real, owned map, not
// a client-side mock: mints a throwaway user (createDemoUserDao) and a
// fresh copy of the "demo" template (see mapAbl.ts's MAP_TEMPLATES) through
// the exact same createMapAbl a real user's "new map" flow goes through, so
// this gets the exact same node-creation/circle-detection behavior a real
// map would. Isolated per visitor — everyone who tries the demo gets their
// own copy, not a shared one others could disrupt.
export const createDemoSessionAbl = async () => {
  const user = await createDemoUserDao();
  const map = await createMapAbl(
    { name: "Demo map", ownerColor: DEMO_OWNER_COLOR, template: "demo" },
    user._id.toString(),
  );

  return { user, map };
};

const setUsernameSchema = z.object({ username: usernameSchema });

// Picking (or keeping) your own username. Keeping the current one is fine —
// it only counts as taken when it belongs to someone else.
export const setUsernameAbl = async (userId: string, input: unknown) => {
  const { username } = parseOrThrow(setUsernameSchema, input);
  const holder = await findUserByUsernameInsensitiveDao(username);
  if (holder && holder._id.toString() !== userId.toString()) throw new UsernameTakenError();
  return await setUsernameDao(userId, username);
};
