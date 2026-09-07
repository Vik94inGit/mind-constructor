import mongoose from "mongoose";

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    // Not required: a Google-registered account (see authAbl.ts's
    // googleAuthAbl) has no password at all — it's only ever signed into
    // via a verified Google ID token, never email+password. `loginAbl`
    // still requires this to actually match, so an account with no
    // passwordHash simply has no working plain-login path, by design.
    passwordHash: { type: String, required: false },
    // Google's own stable per-account id ("sub" claim) — sparse so it's
    // absent (not merely null) on every password-only account instead of
    // colliding on a shared `null` under the unique index.
    googleId: { type: String, unique: true, sparse: true },
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
