import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { Map } from "../models/Map.js";
import { Node } from "../models/Node.js";

interface CreateUserInput {
  username: string;
  email: string;
  password: string;
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
  console.log("Created user:", user);
  return user;
};

export const findUserByEmailDao = async (email: string) => {
  return User.findOne({ email });
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

export const getAllUsersDao = async () => {
  return await User.find({});
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
    // Node.deleteMany({}),
  ]);
  console.log(`Deleted ${users.deletedCount} users`);
  console.log(`Deleted ${maps.deletedCount} maps`);
  console.log(`Deleted ${nodes.deletedCount} nodes`);
  return { users, maps, nodes };
};
