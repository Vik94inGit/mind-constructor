import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
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
    const authHeader = req.headers.authorization;
    console.log("Auth header:", authHeader);
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Not authorized – no token",
      });
    }

    const token = authHeader.split(" ")[1];

    // Verify token (replace process.env.JWT_SECRET with your real secret)
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string;
    };

    const user = await findUserByIdDao(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "User no longer exists",
      });
    }

    // Checked on every request (not just at login), so blocking someone
    // takes effect immediately — unlike logout, this doesn't need to wait
    // for their token to expire.
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
    };

    next();
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(401).json({
      success: false,
      error: "Not authorized – invalid token",
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
