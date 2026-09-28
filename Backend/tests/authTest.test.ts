import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../server.js"; // export your express app
import mongoose from "mongoose";

describe("Auth", () => {
  beforeAll(async () => {
    // connect to test database
    await mongoose.connect(process.env.MONGO_URI_TEST!);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
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
