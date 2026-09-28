import { Request, Response, NextFunction } from "express";
import { findUserByIdDao } from "../dao/userDao.js";
import type { UserRole } from "../models/User.js";

// Extend Express Request type so TypeScript knows about req.user
declare global {
  namespace Express {
    interface Request {
      user?: {
        _id: string;
        username: string;
        email: string;
        role: UserRole;
        isDemo: boolean;
      };
    }
  }
}

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Not authorized – no session",
      });
    }

    const user = await findUserByIdDao(userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "User no longer exists",
      });
    }

    // Checked on every request (not just at login), so blocking someone
    // takes effect immediately — logout is now a real revocation too (see
    // authController.ts's logout), but a still-blocked user's *own* session
    // shouldn't need to wait for anyone to explicitly log them out.
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        error: "This account has been blocked",
      });
    }

    // Attach user to the request (without passwordHash)
    req.user = {
      _id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
      isDemo: user.isDemo,
    };

    next();
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(401).json({
      success: false,
      error: "Not authorized",
    });
  }
};

// Must run after `protect` — assumes req.user is already set.
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      error: "Admin access required",
    });
  }
  next();
};
