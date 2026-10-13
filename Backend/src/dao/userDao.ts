import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { User } from "../models/User.js";
import { Map } from "../models/Map.js";
import { Node } from "../models/Node.js";
import { Image } from "../models/Image.js";

interface CreateUserInput {
  username: string;
  email: string;
  password: string;
}

interface CreateGoogleUserInput {
  username: string;
  email: string;
  googleId: string;
  usernameConfirmed?: boolean;
}

// User input goes into a RegExp below — escape it so "a.b" or "(" match
// themselves instead of being read as a pattern (or throwing).
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface UpdateUserInput {
  username?: string;
  email?: string;
  password?: string;
}

export const createUserDao = async (data: CreateUserInput) => {
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(data.password, salt);

  const user = await User.create({
    username: data.username,
    email: data.email,
    passwordHash,
  });
  return user;
};

export const findUserByEmailDao = async (email: string) => {
  return User.findOne({ email });
};

export const findUserByGoogleIdDao = async (googleId: string) => {
  return User.findOne({ googleId });
};

export const findUserByUsernameDao = async (username: string) => {
  return User.findOne({ username });
};

// Case-insensitive — "Alice" and "alice" would be two different rows to
// the unique index, but the same person to anyone searching for them, so
// a username counts as taken regardless of case.
export const findUserByUsernameInsensitiveDao = async (username: string) => {
  return User.findOne({ username: new RegExp(`^${escapeRegExp(username)}$`, "i") }).select("-passwordHash");
};

export const setUsernameDao = async (id: string, username: string) => {
  return User.findByIdAndUpdate(id, { username, usernameConfirmed: true }, { new: true }).select("-passwordHash");
};

// The invite box's search: a username containing the query, or an email
// matching it exactly. Never a partial email match and never the email in
// the result, so nobody can list other people's addresses by typing letters.
// Blocked and throwaway demo accounts never show up — nobody can sign in as
// the first or would ever come back as the second.
export const searchUsersDao = async (query: string, excludeIds: string[], limit: number) => {
  const q = escapeRegExp(query);
  return await User.find({
    _id: { $nin: excludeIds },
    isBlocked: { $ne: true },
    isDemo: { $ne: true },
    $or: [{ username: new RegExp(q, "i") }, { email: query.trim().toLowerCase() }],
  })
    .select("_id username")
    .sort({ username: 1 })
    .limit(limit)
    .lean();
};

// No passwordHash at all — this account only ever signs in via a verified
// Google ID token (see authAbl.ts's googleAuthAbl), never email+password.
export const createGoogleUserDao = async (data: CreateGoogleUserInput) => {
  const user = await User.create({
    username: data.username,
    email: data.email,
    googleId: data.googleId,
    usernameConfirmed: data.usernameConfirmed ?? true,
  });
  return user;
};

// No passwordHash, no googleId — a fresh throwaway account for a visitor
// trying the app without registering (see authAbl.ts's
// createDemoSessionAbl). username/email both carry a random suffix since
// both are unique-indexed and nothing meaningful identifies this visitor.
export const createDemoUserDao = async () => {
  const suffix = nanoid(8);
  return await User.create({
    username: `demo-${suffix}`,
    email: `demo-${suffix}@demo.mindconstructor.local`,
    isDemo: true,
  });
};

// Links a Google account onto an existing password-registered user found by
// email — same person signing in a different way, not a second account.
export const linkGoogleIdDao = async (id: string, googleId: string) => {
  return User.findByIdAndUpdate(id, { googleId }, { new: true });
};

export const findUserByIdDao = async (id: string) => {
  return User.findById(id).select("-passwordHash");
};

export const updateUserDao = async (id: string, updates: UpdateUserInput) => {
  const payload: Record<string, unknown> = { ...updates };

  if (updates.password) {
    const salt = await bcrypt.genSalt(12);
    payload.passwordHash = await bcrypt.hash(updates.password, salt);
    delete payload.password;
  }

  return User.findByIdAndUpdate(id, payload);
};

// .select("-passwordHash").lean() — the controller strips passwordHash
// again itself (toPublicUser), but there's no reason to fetch it or pay for
// document hydration for a list that's only ever serialized, never
// mutated/saved back.
export const getAllUsersDao = async () => {
  return await User.find({}).select("-passwordHash").lean();
};

export const deleteUserDao = async (id: string) => {
  return User.findByIdAndDelete(id);
};

export const setUserBlockedDao = async (id: string, isBlocked: boolean) => {
  return User.findByIdAndUpdate(id, { isBlocked }, { new: true });
};

export const deleteAllDao = async () => {
  const [users, maps, nodes] = await Promise.all([
    User.deleteMany({}),
    Map.deleteMany({}),
    Node.deleteMany({}),
    Image.deleteMany({}),
  ]);
  console.log(`Deleted ${users.deletedCount} users`);
  console.log(`Deleted ${maps.deletedCount} maps`);
  console.log(`Deleted ${nodes.deletedCount} nodes`);
  return { users, maps, nodes };
};
