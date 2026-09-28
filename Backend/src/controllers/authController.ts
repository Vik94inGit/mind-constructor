import { Request, Response } from "express";
import {
  registerAbl,
  loginAbl,
  googleAuthAbl,
  createDemoSessionAbl,
  EmailAlreadyInUseError,
  InvalidCredentialsError,
  AccountBlockedError,
  GoogleTokenInvalidError,
} from "../abl/authAbl.js";
import { handleAblError } from "./errorHandling.js";

// Promisified req.session.regenerate — express-session's own callback shape.
// Used on login/googleAuth to rotate the session id on every privilege
// change (a pre-login session id shouldn't carry over into a post-login,
// authenticated one — standard session-fixation hygiene), and everywhere a
// response is about to carry a fresh Set-Cookie: regenerate() clears session
// data as part of rotating the id, so `userId` has to be assigned *inside*
// this callback, and the whole thing awaited before responding — otherwise
// the response could go out before the new session finished persisting.
const regenerateSession = (req: Request): Promise<void> =>
  new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });

// ========== REGISTER ==========
export const register = async (req: Request, res: Response) => {
  try {
    const { user } = await registerAbl(req.body);
    await regenerateSession(req);
    req.session.userId = user._id.toString();

    return res.status(201).json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isDemo: user.isDemo,
      },
    });
  } catch (error) {
    return handleAblError(
      res,
      error,
      [[EmailAlreadyInUseError, 409, "Email already in use"]],
      { message: "Internal Server Error", logLabel: "register" },
    );
  }
};

// ========== LOGIN ==========
export const login = async (req: Request, res: Response) => {
  try {
    const { user } = await loginAbl(req.body);
    await regenerateSession(req);
    req.session.userId = user._id.toString();

    return res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isDemo: user.isDemo,
      },
    });
  } catch (error) {
    return handleAblError(
      res,
      error,
      [
        [InvalidCredentialsError, 401, "Invalid email or password"],
        [AccountBlockedError, 403, "This account has been blocked"],
      ],
      { message: "Internal Server Error", logLabel: "login" },
    );
  }
};
// ========== GOOGLE ==========
// One endpoint for both registering and logging in via Google — see
// googleAuthAbl's own doc comment for why there's no separate path.
export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { user } = await googleAuthAbl(req.body);
    await regenerateSession(req);
    req.session.userId = user._id.toString();

    return res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isDemo: user.isDemo,
      },
    });
  } catch (error) {
    return handleAblError(
      res,
      error,
      [
        [GoogleTokenInvalidError, 401, "Invalid Google sign-in"],
        [AccountBlockedError, 403, "This account has been blocked"],
      ],
      { message: "Internal Server Error", logLabel: "google auth" },
    );
  }
};

// ========== DEMO ==========
// No request body — every call mints a brand-new throwaway account and map
// (see createDemoSessionAbl), so there's nothing to validate and nothing
// but a 500 to catch.
export const demoAuth = async (req: Request, res: Response) => {
  try {
    const { user, map } = await createDemoSessionAbl();
    await regenerateSession(req);
    req.session.userId = user._id.toString();

    return res.status(201).json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isDemo: user.isDemo,
      },
      map: { mapId: map.mapId },
    });
  } catch (error) {
    return handleAblError(res, error, [], {
      message: "Internal Server Error",
      logLabel: "demo auth",
    });
  }
};

// ========== ME ==========
// Who the current session cookie belongs to — protect() has already loaded
// and attached req.user by the time this runs. New: the frontend used to
// fake this by decoding a JWT's id claim client-side and cross-referencing
// the user list; there's no token to decode any more, so it needs a real
// endpoint to ask the server instead.
export const me = async (req: Request, res: Response) => {
  return res.status(200).json({ success: true, user: req.user });
};

export const logout = async (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return handleAblError(res, err, [], {
        message: "Internal Server Error",
        logLabel: "logout",
      });
    }
    // destroy() removes the Redis-side record; clearCookie tells the
    // browser to drop its now-pointless copy of the cookie too. Unlike the
    // old JWT version, this actually revokes access immediately — the
    // session is gone server-side, not just "the client agreed to forget
    // its token."
    res.clearCookie("mc_sid");
    return res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  });
};
