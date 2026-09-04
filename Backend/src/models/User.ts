import mongoose from "mongoose";

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, default: "user" },
    isBlocked: { type: Boolean, default: false }, // blocked users can't authenticate, even with a valid token
  },
  {
    toJSON: {
      transform(_doc, ret: any) {
        delete ret.__v; // Mongoose's internal version key — not part of the API contract
        return ret;
      },
    },
  },
);

export const User = mongoose.model("User", UserSchema);
