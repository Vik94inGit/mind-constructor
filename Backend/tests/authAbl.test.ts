import { describe, beforeEach, it, expect, vi } from "vitest";
import bcrypt from "bcryptjs";
import { createUserDao, findUserByEmailDao } from "../src/dao/userDao.js";
import {
  registerAbl,
  loginAbl,
  EmailAlreadyInUseError,
  InvalidCredentialsError,
  AccountBlockedError,
} from "../src/abl/authAbl.js";
import { ValidationError } from "../src/abl/errors.js";

vi.mock("../src/dao/userDao.js", () => ({
  createUserDao: vi.fn(),
  findUserByEmailDao: vi.fn(),
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
      process.env.JWT_SECRET = "test-secret";

      await registerAbl({ username: "alice", email: "  Alice@Test.com  ", password: "secret123" });

      expect(createUserDao).toHaveBeenCalledWith({
        username: "alice", email: "alice@test.com", password: "secret123",
      });
    });

    it("creates the user and issues a token", async () => {
      vi.mocked(findUserByEmailDao).mockResolvedValue(null as never);
      vi.mocked(createUserDao).mockResolvedValue({
        _id: "u1", username: "alice", email: "alice@test.com",
      } as never);
      process.env.JWT_SECRET = "test-secret";

      const result = await registerAbl({
        username: "alice", email: "alice@test.com", password: "secret123",
      });

      expect(createUserDao).toHaveBeenCalledWith({
        username: "alice", email: "alice@test.com", password: "secret123",
      });
      expect(result.user._id).toBe("u1");
      expect(typeof result.token).toBe("string");
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
      process.env.JWT_SECRET = "test-secret";

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
      process.env.JWT_SECRET = "test-secret";

      const result = await loginAbl({ email: "alice@test.com", password: "secret123" });

      expect(result.user._id).toBe("u1");
      expect(typeof result.token).toBe("string");
    });

    it("rejects a blocked user even with the correct password", async () => {
      const hash = await bcrypt.hash("secret123", 4);
      vi.mocked(findUserByEmailDao).mockResolvedValue({
        _id: "u1", username: "alice", email: "alice@test.com", passwordHash: hash, isBlocked: true,
      } as never);
      process.env.JWT_SECRET = "test-secret";

      await expect(
        loginAbl({ email: "alice@test.com", password: "secret123" }),
      ).rejects.toThrow(AccountBlockedError);
    });
  });
});
