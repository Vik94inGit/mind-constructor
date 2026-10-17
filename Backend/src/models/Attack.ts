import mongoose from "mongoose";

// The weapon catalog. Damage is snapshotted onto each Attack document, so
// rebalancing a weapon later doesn't rewrite history.
export const WEAPONS = {
  nitpick: { label: "Nitpick", damage: 10 },
  counterpoint: { label: "Counterpoint", damage: 25 },
  fatalFlaw: { label: "Fatal Flaw", damage: 50 },
} as const;

export type WeaponKey = keyof typeof WEAPONS;

const AttackSchema = new mongoose.Schema(
  {
    mapId: { type: mongoose.Schema.Types.ObjectId, ref: "Map", required: true },
    targetNodeId: { type: mongoose.Schema.Types.ObjectId, ref: "Node", required: true },
    attackerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    weapon: { type: String, enum: Object.keys(WEAPONS), required: true },
    damage: { type: Number, required: true },
    // A shield stopped it (damage is then 0) — so a replay can flash the shield.
    blocked: { type: Boolean, default: false },
    // Played by the imitated opponent (the map owner's "Opponent's turn"),
    // not by the person whose account sent it — see Node.byOpponent.
    byOpponent: { type: Boolean, default: false },
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

// A node's attack history (attackDao.ts getAttackHistoryByNodeDao, newest
// first) and a map's replay (listAttacksByMapDao, oldest first) — without
// these both read the whole attacks collection.
AttackSchema.index({ targetNodeId: 1, createdAt: -1 });
AttackSchema.index({ mapId: 1, createdAt: 1 });

export const Attack = mongoose.model("Attack", AttackSchema);
