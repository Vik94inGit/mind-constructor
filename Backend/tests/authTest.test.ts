import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";

// Runs against the real app and its real session cookie, with an in-memory
// stand-in for the user DAO instead of MongoDB (like every other test here),
// so it needs no database. The session itself uses express-session's
// in-memory store, since REDIS_URL isn't set under test.
vi.hoisted(() => {
  process.env.SESSION_SECRET ??= "test-session-secret";
});

type FakeUser = {
  _id: string;
  username: string;
  email: string;
  passwordHash?: string;
  role: "user" | "admin";
  isBlocked: boolean;
  isDemo: boolean;
};

const users = vi.hoisted(() => [] as FakeUser[]);

vi.mock("../src/dao/userDao.js", () => ({
  createUserDao: vi.fn(async (data: { username: string; email: string; password: string }) => {
    const user: FakeUser = {
      _id: `user${users.length + 1}`,
      username: data.username,
      email: data.email,
      passwordHash: await bcrypt.hash(data.password, 4),
      role: "user",
      isBlocked: false,
      isDemo: false,
    };
    users.push(user);
    return user;
  }),
  findUserByEmailDao: vi.fn(async (email: string) => users.find((u) => u.email === email) ?? null),
  findUserByIdDao: vi.fn(async (id: string) => {
    const user = users.find((u) => u._id === id);
    if (!user) return null;
    const { passwordHash: _omit, ...rest } = user;
    return rest;
  }),
  findUserByUsernameDao: vi.fn(async (username: string) => users.find((u) => u.username === username) ?? null),
  findUserByGoogleIdDao: vi.fn(),
  createGoogleUserDao: vi.fn(),
  createDemoUserDao: vi.fn(),
  linkGoogleIdDao: vi.fn(),
  updateUserDao: vi.fn(),
  getAllUsersDao: vi.fn(),
  deleteUserDao: vi.fn(),
  setUserBlockedDao: vi.fn(),
  deleteAllDao: vi.fn(),
}));

let app: typeof import("../server.js").app;

describe("Auth", () => {
  beforeAll(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    ({ app } = await import("../server.js"));
  });

  it("registers a new user and the session cookie authenticates a follow-up request", async () => {
    // A single agent (not bare `request(app)`) persists Set-Cookie across
    // calls — the session is a cookie now, not an echoed token, so proving
    // it round-trips means actually using it on a second request.
    const agent = request.agent(app);
    const res = await agent.post("/api/auth/register").send({
      username: "testuser",
      email: "test@example.com",
      password: "secret123",
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeUndefined();
    expect(res.body.user.email).toBe("test@example.com");

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("test@example.com");
  });

  it("logs in an existing user", async () => {
    const agent = request.agent(app);
    const res = await agent.post("/api/auth/login").send({
      email: "test@example.com",
      password: "secret123",
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
  });

  it("rejects wrong password", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "test@example.com",
      password: "wrongpassword",
    });

    expect(res.status).toBe(401);
  });

  it("logout ends the session", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({
      email: "test@example.com",
      password: "secret123",
    });

    const logoutRes = await agent.post("/api/auth/logout");
    expect(logoutRes.status).toBe(200);

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(401);
  });
});
