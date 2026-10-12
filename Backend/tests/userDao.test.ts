import { describe, beforeEach, it, expect, vi } from "vitest";
import bcrypt from "bcryptjs";
import { User } from "../src/models/User.js";
import { Map } from "../src/models/Map.js";
import { Node } from "../src/models/Node.js";
import { Image } from "../src/models/Image.js";
import {
  createUserDao,
  createGoogleUserDao,
  createDemoUserDao,
  findUserByEmailDao,
  findUserByIdDao,
  updateUserDao,
  getAllUsersDao,
  setUserBlockedDao,
  linkGoogleIdDao,
  deleteAllDao,
} from "../src/dao/userDao.js";

vi.mock("bcryptjs", () => ({
  default: {
    genSalt: vi.fn().mockResolvedValue("salt"),
    hash: vi.fn().mockResolvedValue("hashed"),
  },
}));

// Mock Mongoose models for Vitest
vi.mock("../src/models/User.js", () => ({
  User: {
    create: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    find: vi.fn(),
    deleteMany: vi.fn(),
  },
}));
vi.mock("../src/models/Map.js", () => ({ Map: { deleteMany: vi.fn() } }));
vi.mock("../src/models/Node.js", () => ({ Node: { deleteMany: vi.fn() } }));
vi.mock("../src/models/Image.js", () => ({ Image: { deleteMany: vi.fn() } }));

describe("userDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createUserDao", () => {
    it("stores a password hash, never the plain password", async () => {
      vi.mocked(User.create).mockResolvedValue({ _id: "u1" } as never);

      await createUserDao({ username: "alice", email: "a@test.com", password: "secret123" });

      expect(bcrypt.hash).toHaveBeenCalledWith("secret123", "salt");
      expect(User.create).toHaveBeenCalledWith({
        username: "alice",
        email: "a@test.com",
        passwordHash: "hashed",
      });
    });
  });

  it("createGoogleUserDao stores the googleId and no password", async () => {
    await createGoogleUserDao({ username: "bob", email: "b@test.com", googleId: "g1" });

    expect(User.create).toHaveBeenCalledWith({
      username: "bob",
      email: "b@test.com",
      googleId: "g1",
      usernameConfirmed: true,
    });
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });

  it("createDemoUserDao gives the demo account a matching random username and email", async () => {
    await createDemoUserDao();

    const arg = vi.mocked(User.create).mock.calls[0][0] as unknown as {
      username: string;
      email: string;
      isDemo: boolean;
    };
    expect(arg.isDemo).toBe(true);
    const suffix = arg.username.replace(/^demo-/, "");
    expect(suffix).toHaveLength(8);
    expect(arg.email).toBe(`demo-${suffix}@demo.mindconstructor.local`);
  });

  it("findUserByEmailDao looks the user up by email", async () => {
    vi.mocked(User.findOne).mockResolvedValue({ _id: "u1" } as never);

    const user = await findUserByEmailDao("a@test.com");

    expect(User.findOne).toHaveBeenCalledWith({ email: "a@test.com" });
    expect(user).toEqual({ _id: "u1" });
  });

  it("findUserByIdDao leaves the password hash out", async () => {
    const select = vi.fn().mockResolvedValue({ _id: "u1" });
    vi.mocked(User.findById).mockReturnValue({ select } as never);

    await findUserByIdDao("u1");

    expect(User.findById).toHaveBeenCalledWith("u1");
    expect(select).toHaveBeenCalledWith("-passwordHash");
  });

  describe("updateUserDao", () => {
    it("hashes a new password into passwordHash", async () => {
      await updateUserDao("u1", { username: "alice2", password: "newpass" });

      expect(bcrypt.hash).toHaveBeenCalledWith("newpass", "salt");
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith("u1", {
        username: "alice2",
        passwordHash: "hashed",
      });
    });

    it("passes other fields through untouched when there is no password", async () => {
      await updateUserDao("u1", { email: "new@test.com" });

      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith("u1", { email: "new@test.com" });
    });
  });

  it("getAllUsersDao lists users without password hashes", async () => {
    const lean = vi.fn().mockResolvedValue([{ _id: "u1" }]);
    const select = vi.fn().mockReturnValue({ lean });
    vi.mocked(User.find).mockReturnValue({ select } as never);

    const users = await getAllUsersDao();

    expect(User.find).toHaveBeenCalledWith({});
    expect(select).toHaveBeenCalledWith("-passwordHash");
    expect(users).toEqual([{ _id: "u1" }]);
  });

  it("setUserBlockedDao returns the updated user", async () => {
    await setUserBlockedDao("u1", true);

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith("u1", { isBlocked: true }, { new: true });
  });

  it("linkGoogleIdDao links the Google account onto the user", async () => {
    await linkGoogleIdDao("u1", "g1");

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith("u1", { googleId: "g1" }, { new: true });
  });

  it("deleteAllDao wipes users, maps, nodes and images", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(User.deleteMany).mockResolvedValue({ deletedCount: 2 } as never);
    vi.mocked(Map.deleteMany).mockResolvedValue({ deletedCount: 3 } as never);
    vi.mocked(Node.deleteMany).mockResolvedValue({ deletedCount: 4 } as never);
    vi.mocked(Image.deleteMany).mockResolvedValue({ deletedCount: 5 } as never);

    const result = await deleteAllDao();

    expect(Image.deleteMany).toHaveBeenCalledWith({});
    expect(result.users.deletedCount).toBe(2);
    expect(result.maps.deletedCount).toBe(3);
    expect(result.nodes.deletedCount).toBe(4);
  });
});
