import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { User } from "../models/User.js";
import { Map } from "../models/Map.js";
import { Node } from "../models/Node.js";

interface CreateUserInput {
  username: string;
  email: string;
  password: string;
}

interface CreateGoogleUserInput {
  username: string;
  email: string;
  googleId: string;
}

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

// No passwordHash at all — this account only ever signs in via a verified
// Google ID token (see authAbl.ts's googleAuthAbl), never email+password.
export const createGoogleUserDao = async (data: CreateGoogleUserInput) => {
  const user = await User.create({
    username: data.username,
    email: data.email,
    googleId: data.googleId,
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
  ]);
  console.log(`Deleted ${users.deletedCount} users`);
  console.log(`Deleted ${maps.deletedCount} maps`);
  console.log(`Deleted ${nodes.deletedCount} nodes`);
  return { users, maps, nodes };
};
