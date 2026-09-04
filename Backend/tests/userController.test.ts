import { Request, Response } from "express";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock must use the same path that the controller uses internally
vi.mock("../src/dao/userDao.js", () => ({
  createUserDao: vi.fn(),
  findUserByIdDao: vi.fn(),
  findUserByEmailDao: vi.fn(),
  updateUserDao: vi.fn(),
  deleteUserDao: vi.fn(),
}));

// Import the mocked DAO and the controller under test
import * as userDao from "../src/dao/userDao.js";
import {
  createUser,
  getUserById,
  updateUser,
  deleteUser,
} from "../src/controllers/userController.js";

function mockRequest(overrides: Partial<Request> = {}): Request {
  return { params: {}, body: {}, ...overrides } as unknown as Request;
}

function mockResponse(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res) as unknown as Response["status"];
  res.json = vi.fn().mockReturnValue(res) as unknown as Response["json"];
  return res as Response;
}

function asMock(fn: unknown) {
  return fn as ReturnType<typeof vi.fn>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createUser", () => {
  it("returns 400 if required fields are missing", async () => {
    const req = mockRequest({ body: { username: "alice" } });
    const res = mockResponse();

    await createUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(userDao.createUserDao).not.toHaveBeenCalled();
  });

  it("returns 409 if the email is already in use", async () => {
    asMock(userDao.findUserByEmailDao).mockResolvedValue({ _id: "u1" });

    const req = mockRequest({
      body: {
        username: "alice",
        email: "a@test.com",
        password: "secret123",
      },
    });
    const res = mockResponse();

    await createUser(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(userDao.createUserDao).not.toHaveBeenCalled();
  });

  it("creates a user and never returns passwordHash", async () => {
    asMock(userDao.findUserByEmailDao).mockResolvedValue(null);
    asMock(userDao.createUserDao).mockResolvedValue({
      _id: "u1",
      username: "alice",
      email: "a@test.com",
      passwordHash: "hashed-secret",
    });

    const req = mockRequest({
      body: {
        username: "alice",
        email: "a@test.com",
        password: "secret123",
      },
    });
    const res = mockResponse();

    await createUser(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const jsonArg = asMock(res.json).mock.calls[0][0];
    expect(jsonArg.passwordHash).toBeUndefined();
    expect(jsonArg.username).toBe("alice");
  });
});
