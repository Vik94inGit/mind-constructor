import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createUserDao, findUserByEmailDao } from "../dao/userDao.js";
import { parseOrThrow } from "./errors.js";

export class EmailAlreadyInUseError extends Error {}
export class InvalidCredentialsError extends Error {}
export class AccountBlockedError extends Error {}

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

const generateToken = (userId: string) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET as string, {
    expiresIn: "1minute",
  });

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
