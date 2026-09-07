import { Request, Response } from "express";
import {
  registerAbl,
  loginAbl,
  googleAuthAbl,
  EmailAlreadyInUseError,
  InvalidCredentialsError,
  AccountBlockedError,
  GoogleTokenInvalidError,
} from "../abl/authAbl.js";
import { ValidationError } from "../abl/errors.js";

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
      },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error instanceof EmailAlreadyInUseError) {
      return res.status(409).json({ success: false, error: "Email already in use" });
    }
    console.error("register error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
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
      },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error instanceof InvalidCredentialsError) {
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }
    if (error instanceof AccountBlockedError) {
      return res.status(403).json({ success: false, error: "This account has been blocked" });
    }
    console.error("login error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
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
      },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error instanceof GoogleTokenInvalidError) {
      return res.status(401).json({ success: false, error: "Invalid Google sign-in" });
    }
    if (error instanceof AccountBlockedError) {
      return res.status(403).json({ success: false, error: "This account has been blocked" });
    }
    console.error("google auth error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
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
    console.error("logout error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
};
