import type { Request, Response } from "express";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/dao/userDao.js", () => ({
  getAllUsersDao: vi.fn(),
  deleteAllDao: vi.fn(),
}));

import * as userDao from "../src/dao/userDao.js";
import { authed, isIdList, param, publicMapIdOf } from "../src/controllers/errorHandling.js";
import { getAllUsers } from "../src/controllers/userController.js";
import { MapFinishedError, ValidationError } from "../src/abl/errors.js";

class GoneError extends Error {}

function mockRequest(overrides: Record<string, unknown> = {}): Request {
  return { params: {}, body: {}, query: {}, user: { _id: "u1" }, ...overrides } as unknown as Request;
}

function mockResponse() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res) as unknown as Response["status"];
  res.json = vi.fn().mockReturnValue(res) as unknown as Response["json"];
  return res;
}

const sent = (res: Response) => ({
  status: (res.status as ReturnType<typeof vi.fn>).mock.calls[0]?.[0],
  body: (res.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0],
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("authed", () => {
  it("answers 401 without running the action when there is no user", async () => {
    const action = vi.fn();
    const res = mockResponse();
    await authed("t", action)(mockRequest({ user: undefined }), res);
    expect(action).not.toHaveBeenCalled();
    expect(sent(res)).toEqual({ status: 401, body: { success: false, error: "Not authenticated" } });
  });

  it("runs the action with the caller's id", async () => {
    const res = mockResponse();
    await authed("t", (_req, r, userId) => r.status(200).json({ userId }))(mockRequest(), res);
    expect(sent(res)).toEqual({ status: 200, body: { userId: "u1" } });
  });

  it("maps a thrown domain error to its status and message", async () => {
    const res = mockResponse();
    const handler = authed(
      "t",
      async () => {
        throw new GoneError();
      },
      { errors: [[GoneError, 404, "Gone"]] },
    );
    await handler(mockRequest(), res);
    expect(sent(res)).toEqual({ status: 404, body: { success: false, error: "Gone" } });
  });

  it("maps ValidationError to 400 and MapFinishedError to 409 for every action", async () => {
    const res = mockResponse();
    await authed("t", async () => {
      throw new ValidationError("bad input");
    })(mockRequest(), res);
    expect(sent(res)).toEqual({ status: 400, body: { success: false, error: "bad input" } });

    const res2 = mockResponse();
    await authed("t", async () => {
      throw new MapFinishedError();
    })(mockRequest(), res2);
    expect(sent(res2).status).toBe(409);
    expect(sent(res2).body.finished).toBe(true);
  });

  it("falls back to 500 with the action's own message, and logs the error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = mockResponse();
    await authed(
      "doThing",
      async () => {
        throw new Error("boom");
      },
      { message: "Could not do the thing" },
    )(mockRequest(), res);
    expect(sent(res)).toEqual({ status: 500, body: { success: false, error: "Could not do the thing" } });
    expect(log).toHaveBeenCalledWith("doThing error:", expect.any(Error));
    log.mockRestore();
  });
});

describe("small helpers", () => {
  it("param takes the first value when Express hands over an array", () => {
    expect(param({ params: { mapId: "a" } }, "mapId")).toBe("a");
    expect(param({ params: { mapId: ["b", "c"] } }, "mapId")).toBe("b");
  });

  it("publicMapIdOf reads a populated mapId, or null", () => {
    expect(publicMapIdOf({ mapId: { mapId: "m1" } })).toBe("m1");
    expect(publicMapIdOf({ mapId: "raw-object-id" })).toBe(null);
    expect(publicMapIdOf(null)).toBe(null);
  });

  it("isIdList accepts only a non-empty array of strings", () => {
    expect(isIdList(["a", "b"])).toBe(true);
    expect(isIdList([])).toBe(false);
    expect(isIdList(["a", 1])).toBe(false);
    expect(isIdList("a")).toBe(false);
  });
});

describe("getAllUsers", () => {
  it("never returns passwordHash", async () => {
    (userDao.getAllUsersDao as ReturnType<typeof vi.fn>).mockResolvedValue([
      { _id: "u2", username: "ann", passwordHash: "secret" },
    ]);
    const res = mockResponse();
    await getAllUsers(mockRequest(), res);
    expect(sent(res)).toEqual({ status: 200, body: [{ _id: "u2", username: "ann" }] });
  });
});
