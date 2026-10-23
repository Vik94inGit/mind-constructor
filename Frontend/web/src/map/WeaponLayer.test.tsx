import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeaponLayer } from "./WeaponLayer";
import type { NodeDoc } from "../types";

const node = (over: Partial<NodeDoc>): NodeDoc => ({
  nodeId: "n",
  text: "",
  type: "Problem",
  parentId: null,
  userId: "u",
  health: 100,
  defeated: false,
  ...over,
});

const target = node({ nodeId: "target", x: 300, y: 100 });
const attack = node({ nodeId: "attack", x: 100, y: 100, isWeapon: true, weaponIcon: "spear", targetNodeId: "target" });

const layer = (chompId: string | null) => (
  <WeaponLayer
    visibleNodes={[target, attack]}
    posFor={(n) => ({ x: n.x ?? 0, y: n.y ?? 0 })}
    celebrateIds={new Set()}
    shotState={null}
    chompId={chompId}
  />
);

describe("WeaponLayer's Pac-Man run", () => {
  it("draws the pie only for the hovered attack, starting on it and facing its target", () => {
    const { rerender } = render(layer(null));
    expect(screen.queryByTestId("pacman-chomp")).toBeNull();
    rerender(layer("attack"));
    expect(screen.getByTestId("pacman-chomp").getAttribute("transform")).toBe("translate(100 100) rotate(0)");
  });
});
