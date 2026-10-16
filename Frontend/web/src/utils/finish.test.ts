import { describe, expect, it } from "vitest";
import { battleTally, finishState, healthAt } from "./finish";
import type { MapAttack, MapDoc, NodeDoc } from "../types";

const node = (nodeId: string, userId: string, createdAt: string, extra: Partial<NodeDoc> = {}) =>
  ({ nodeId, userId, createdAt, text: "", type: "Problem", x: 0, y: 0, health: 100, defeated: false, ...extra }) as NodeDoc;
const duel = (agreed: string[] = []): MapDoc =>
  ({ mapId: "m", name: "m", ownerId: "me", members: ["me", "rival"], finishAgreedBy: agreed }) as MapDoc;
const solo: MapDoc = { mapId: "m", name: "m", ownerId: "me", members: ["me"] } as MapDoc;

describe("finishState", () => {
  it("allows an empty map", () => {
    expect(finishState(duel(), [])).toMatchObject({ allowed: true, reason: "empty" });
  });

  it("allows it once the opponent had the last word", () => {
    const nodes = [node("a", "me", "2026-01-01"), node("b", "rival", "2026-01-02")];
    expect(finishState(duel(), nodes)).toMatchObject({ allowed: true, reason: "opponentLastWord" });
  });

  it("refuses right after the owner's own point, naming who it waits for", () => {
    const nodes = [node("b", "rival", "2026-01-01"), node("a", "me", "2026-01-02")];
    expect(finishState(duel(), nodes)).toMatchObject({ allowed: false, waitingFor: ["rival"] });
  });

  it("allows it when everyone else agreed", () => {
    expect(finishState(duel(["rival"]), [node("a", "me", "2026-01-02")])).toMatchObject({
      allowed: true,
      reason: "everyoneAgreed",
    });
  });

  it("counts the imitated opponent's move as the opponent's word, and waits after the owner answers it", () => {
    const opp = node("o", "me", "2026-01-01", { byOpponent: true });
    expect(finishState(solo, [opp])).toMatchObject({ allowed: true, reason: "opponentLastWord" });
    expect(finishState(solo, [opp, node("a", "me", "2026-01-02")])).toMatchObject({ allowed: false });
  });

  it("allows a map nobody argues against", () => {
    expect(finishState(solo, [node("a", "me", "2026-01-02")])).toMatchObject({ allowed: true, reason: "noOpponent" });
  });
});

describe("healthAt", () => {
  const hit = (targetNodeId: string, damage: number, createdAt: string): MapAttack => ({
    targetNodeId,
    weapon: "nitpick",
    damage,
    blocked: false,
    byOpponent: false,
    createdAt,
  });

  it("gives back the damage taken after the moment shown", () => {
    const nodes = [node("a", "me", "2026-01-01", { health: 0, defeated: true })];
    const attacks = [hit("a", 40, "2026-01-02"), hit("a", 60, "2026-01-03")];
    expect(healthAt(nodes, attacks, "2026-01-01")[0]).toMatchObject({ health: 100, defeated: false });
    expect(healthAt(nodes, attacks, "2026-01-02")[0]).toMatchObject({ health: 60, defeated: false });
    expect(healthAt(nodes, attacks, "2026-01-03")[0]).toMatchObject({ health: 0, defeated: true });
  });
});

describe("battleTally", () => {
  it("counts the map's own points, not attacks or shields", () => {
    const nodes = [
      node("a", "me", "1"),
      node("b", "me", "2", { defeated: true }),
      node("w", "me", "3", { isWeapon: true }),
      node("p", "me", "4", { isProtection: true }),
    ];
    expect(battleTally(nodes)).toEqual({ standing: 1, fallen: 1 });
  });
});
