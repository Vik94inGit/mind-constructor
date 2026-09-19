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

// ========== REGISTER ==========
export const register = async (req: Request, res: Response) => {
  try {
    const { user, token } = await registerAbl(req.body);

    return res.status(201).json({
      success: true,
      token,
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
    const { user, token } = await loginAbl(req.body);

    return res.status(200).json({
      success: true,
      token,
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
    const { user, token } = await googleAuthAbl(req.body);

    return res.status(200).json({
      success: true,
      token,
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
export const demoAuth = async (_req: Request, res: Response) => {
  try {
    const { user, token, map } = await createDemoSessionAbl();

    return res.status(201).json({
      success: true,
      token,
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

export const logout = async (req: Request, res: Response) => {
  try {
    // Invalidate the token on the client side by instructing the client to remove it.
    // Since JWTs are stateless, we can't invalidate them server-side without additional state management.
    return res.status(200).json({
      success: true,
      message:
        "Logged out successfully. Please remove the token from your client.",
    });
  } catch (error) {
    return handleAblError(res, error, [], {
      message: "Internal Server Error",
      logLabel: "logout",
    });
  }
};
