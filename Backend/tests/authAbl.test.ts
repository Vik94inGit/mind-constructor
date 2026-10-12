import { describe, beforeEach, it, expect, vi } from "vitest";
import bcrypt from "bcryptjs";
import {
  createUserDao,
  findUserByEmailDao,
  findUserByUsernameInsensitiveDao,
  setUsernameDao,
} from "../src/dao/userDao.js";
import {
  registerAbl,
  loginAbl,
  setUsernameAbl,
  defaultUsername,
  UsernameTakenError,
  EmailAlreadyInUseError,
  InvalidCredentialsError,
  AccountBlockedError,
} from "../src/abl/authAbl.js";
import { ValidationError } from "../src/abl/errors.js";

vi.mock("../src/dao/userDao.js", () => ({
  createUserDao: vi.fn(),
  findUserByEmailDao: vi.fn(),
  findUserByUsernameInsensitiveDao: vi.fn(),
  setUsernameDao: vi.fn(),
}));

describe("authAbl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registerAbl", () => {
    it("rejects a missing field", async () => {
      await expect(
        registerAbl({ username: "alice", email: "alice@test.com" }),
      ).rejects.toThrow(ValidationError);
      expect(createUserDao).not.toHaveBeenCalled();
    });

    it("rejects a short password", async () => {
      await expect(
        registerAbl({ username: "alice", email: "alice@test.com", password: "abc" }),
      ).rejects.toThrow(ValidationError);
    });

    it("rejects a duplicate email", async () => {
      vi.mocked(findUserByEmailDao).mockResolvedValue({ _id: "u1" } as never);

      await expect(
        registerAbl({ username: "alice", email: "alice@test.com", password: "secret123" }),
      ).rejects.toThrow(EmailAlreadyInUseError);
      expect(createUserDao).not.toHaveBeenCalled();
    });

    it("rejects a duplicate email that only differs by case", async () => {
      vi.mocked(findUserByEmailDao).mockResolvedValue({ _id: "u1" } as never);

      await expect(
        registerAbl({ username: "alice", email: "Alice@Test.com", password: "secret123" }),
      ).rejects.toThrow(EmailAlreadyInUseError);
      // The lookup itself must be normalized too, or the "duplicate" would
      // never be found in the first place.
      expect(findUserByEmailDao).toHaveBeenCalledWith("alice@test.com");
    });

    it("stores the email lowercased and trimmed", async () => {
      vi.mocked(findUserByEmailDao).mockResolvedValue(null as never);
      vi.mocked(createUserDao).mockResolvedValue({
        _id: "u1", username: "alice", email: "alice@test.com",
      } as never);

      await registerAbl({ username: "alice", email: "  Alice@Test.com  ", password: "secret123" });

      expect(createUserDao).toHaveBeenCalledWith({
        username: "alice", email: "alice@test.com", password: "secret123",
      });
    });

    it("creates the user", async () => {
      vi.mocked(findUserByEmailDao).mockResolvedValue(null as never);
      vi.mocked(createUserDao).mockResolvedValue({
        _id: "u1", username: "alice", email: "alice@test.com",
      } as never);

      const result = await registerAbl({
        username: "alice", email: "alice@test.com", password: "secret123",
      });

      expect(createUserDao).toHaveBeenCalledWith({
        username: "alice", email: "alice@test.com", password: "secret123",
      });
      expect(result.user._id).toBe("u1");
    });
  });

  describe("registerAbl usernames", () => {
    it("rejects a username someone else already has, whatever its case", async () => {
      vi.mocked(findUserByEmailDao).mockResolvedValue(null as never);
      vi.mocked(findUserByUsernameInsensitiveDao).mockResolvedValue({ _id: "u2" } as never);

      await expect(
        registerAbl({ username: "Alice", email: "alice@test.com", password: "secret123" }),
      ).rejects.toThrow(UsernameTakenError);
      expect(createUserDao).not.toHaveBeenCalled();
    });

    it("falls back to the email's part before the @ when no username is given", async () => {
      vi.mocked(findUserByEmailDao).mockResolvedValue(null as never);
      vi.mocked(findUserByUsernameInsensitiveDao).mockResolvedValue(null as never);
      vi.mocked(createUserDao).mockResolvedValue({ _id: "u1" } as never);

      await registerAbl({ username: "  ", email: "viktor.h@test.com", password: "secret123" });

      expect(createUserDao).toHaveBeenCalledWith({
        username: "viktor.h", email: "viktor.h@test.com", password: "secret123",
      });
    });
  });

  describe("defaultUsername", () => {
    it("prefers the Google profile name", async () => {
      vi.mocked(findUserByUsernameInsensitiveDao).mockResolvedValue(null as never);
      expect(await defaultUsername({ name: "Віктор Hash", email: "v@test.com" })).toBe("Віктор Hash");
    });

    it("uses the email prefix when the name has nothing usable", async () => {
      vi.mocked(findUserByUsernameInsensitiveDao).mockResolvedValue(null as never);
      expect(await defaultUsername({ name: "🙂", email: "vik94@test.com" })).toBe("vik94");
    });

    it("numbers a taken name", async () => {
      vi.mocked(findUserByUsernameInsensitiveDao)
        .mockResolvedValueOnce({ _id: "x" } as never)
        .mockResolvedValueOnce(null as never);
      expect(await defaultUsername({ email: "alice@test.com" })).toBe("alice2");
    });
  });

  describe("setUsernameAbl", () => {
    it("lets you keep your own username", async () => {
      vi.mocked(findUserByUsernameInsensitiveDao).mockResolvedValue({ _id: "u1" } as never);
      vi.mocked(setUsernameDao).mockResolvedValue({ _id: "u1", username: "alice" } as never);

      await setUsernameAbl("u1", { username: "alice" });

      expect(setUsernameDao).toHaveBeenCalledWith("u1", "alice");
    });

    it("refuses someone else's", async () => {
      vi.mocked(findUserByUsernameInsensitiveDao).mockResolvedValue({ _id: "u2" } as never);

      await expect(setUsernameAbl("u1", { username: "alice" })).rejects.toThrow(UsernameTakenError);
      expect(setUsernameDao).not.toHaveBeenCalled();
    });

    it("refuses markup characters", async () => {
      await expect(setUsernameAbl("u1", { username: "<b>hi</b>" })).rejects.toThrow(ValidationError);
    });
  });

  describe("loginAbl", () => {
    it("rejects an unknown email without revealing that it's unknown", async () => {
      vi.mocked(findUserByEmailDao).mockResolvedValue(null as never);

      await expect(
        loginAbl({ email: "nobody@test.com", password: "secret123" }),
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it("logs in with a different-cased email than what was stored", async () => {
      const hash = await bcrypt.hash("secret123", 4);
      vi.mocked(findUserByEmailDao).mockResolvedValue({
        _id: "u1", username: "alice", email: "alice@test.com", passwordHash: hash,
      } as never);

      await loginAbl({ email: "Alice@Test.com", password: "secret123" });

      expect(findUserByEmailDao).toHaveBeenCalledWith("alice@test.com");
    });

    it("rejects a wrong password", async () => {
      const hash = await bcrypt.hash("correct-password", 4);
      vi.mocked(findUserByEmailDao).mockResolvedValue({
        _id: "u1", passwordHash: hash,
      } as never);

      await expect(
        loginAbl({ email: "alice@test.com", password: "wrong-password" }),
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it("logs in with the correct password", async () => {
      const hash = await bcrypt.hash("secret123", 4);
      vi.mocked(findUserByEmailDao).mockResolvedValue({
        _id: "u1", username: "alice", email: "alice@test.com", passwordHash: hash,
      } as never);

      const result = await loginAbl({ email: "alice@test.com", password: "secret123" });

      expect(result.user._id).toBe("u1");
    });

    it("rejects a blocked user even with the correct password", async () => {
      const hash = await bcrypt.hash("secret123", 4);
      vi.mocked(findUserByEmailDao).mockResolvedValue({
        _id: "u1", username: "alice", email: "alice@test.com", passwordHash: hash, isBlocked: true,
      } as never);

      await expect(
        loginAbl({ email: "alice@test.com", password: "secret123" }),
      ).rejects.toThrow(AccountBlockedError);
    });
  });
});
