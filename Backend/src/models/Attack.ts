import mongoose from "mongoose";

// The weapon catalog. Damage is snapshotted onto each Attack document, so
// rebalancing a weapon later doesn't rewrite history.
export const WEAPONS = {
  nitpick: { label: "Nitpick", damage: 10, cooldownMs: 0 },
  counterpoint: { label: "Counterpoint", damage: 25, cooldownMs: 5 * 60 * 1000 },
  fatalFlaw: { label: "Fatal Flaw", damage: 50, cooldownMs: 30 * 60 * 1000 },
} as const;

export type WeaponKey = keyof typeof WEAPONS;

const AttackSchema = new mongoose.Schema(
  {
    mapId: { type: mongoose.Schema.Types.ObjectId, ref: "Map", required: true },
    targetNodeId: { type: mongoose.Schema.Types.ObjectId, ref: "Node", required: true },
    attackerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    weapon: { type: String, enum: Object.keys(WEAPONS), required: true },
    damage: { type: Number, required: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        delete ret.__v; // no public "attackId" exists yet, so _id stays — __v never does
        return ret;
      },
    },
  },
);

export const Attack = mongoose.model("Attack", AttackSchema);
