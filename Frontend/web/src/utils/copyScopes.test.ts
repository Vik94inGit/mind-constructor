import { describe, expect, it } from "vitest";
import { ancestorChain, formatChain, readableText, texToText, zoneRootFor } from "./copyScopes";
import { makeNode } from "../test/fixtures";
import type { NodeGroup } from "./canvasLayout";

describe("texToText", () => {
  it("writes powers and indices small when it can", () => {
    expect(texToText("x^{2} + y^2")).toBe("x² + y²");
    expect(texToText("a_{1} + a_n")).toBe("a₁ + aₙ");
    expect(texToText("e^{i\\pi}")).toBe("e^(iπ)");
  });

  it("writes fractions and roots with brackets only where needed", () => {
    expect(texToText("\\frac{a+b}{2}")).toBe("(a+b)/2");
    expect(texToText("\\frac{1}{x}")).toBe("1/x");
    expect(texToText("\\sqrt{x^2+1}")).toBe("√(x²+1)");
    expect(texToText("\\sqrt[3]{8}")).toBe("∛8");
  });

  it("turns symbols and Greek letters into characters and drops sizing", () => {
    expect(texToText("\\alpha \\leq \\beta \\cdot \\gamma")).toBe("α ≤ β · γ");
    expect(texToText("\\left( x \\right)")).toBe("( x )");
    expect(texToText("\\text{area} = \\pi r^2")).toBe("area = π r²");
    expect(texToText("\\sum_{i=1}^{n} i")).toBe("∑ᵢ₌₁ⁿ i");
  });
});

describe("readableText", () => {
  it("leaves text without formulas as it was", () => {
    expect(readableText("costs $5 and $10")).toBe("costs $5 and $10");
  });

  it("rewrites each formula in place", () => {
    expect(readableText("Pythagoras: $a^2+b^2=c^2$, done")).toBe("Pythagoras: a²+b²=c², done");
    expect(readableText("$$\\frac{1}{2}$$")).toBe("1/2");
  });
});

describe("ancestorChain / formatChain", () => {
  const nodes = [
    makeNode({ nodeId: "a", type: "Problem", text: "Root" }),
    makeNode({ nodeId: "b", type: "Idea", text: "Middle", parentId: "a" }),
    makeNode({ nodeId: "c", type: "Solution", text: "Leaf\nsecond line", parentId: "b", order: 2 }),
    makeNode({ nodeId: "d", type: "Idea", text: "Other", parentId: "a" }),
  ];

  it("walks from the top of the branch down to the node", () => {
    expect(ancestorChain(nodes, "c").map((n) => n.nodeId)).toEqual(["a", "b", "c"]);
    expect(ancestorChain(nodes, "a").map((n) => n.nodeId)).toEqual(["a"]);
    expect(ancestorChain(nodes, "zzz")).toEqual([]);
  });

  it("stops at a parent loop", () => {
    const loop = [makeNode({ nodeId: "x", parentId: "y" }), makeNode({ nodeId: "y", parentId: "x" })];
    expect(ancestorChain(loop, "x").map((n) => n.nodeId)).toEqual(["y", "x"]);
  });

  it("indents each node under the one above it", () => {
    expect(formatChain(ancestorChain(nodes, "c"))).toBe(
      ["Problem: Root", "  Idea: Middle", "    2. Solution: Leaf", "      second line"].join("\n"),
    );
  });
});

describe("zoneRootFor", () => {
  const nodes = [
    makeNode({ nodeId: "a" }),
    makeNode({ nodeId: "b", parentId: "a" }),
    makeNode({ nodeId: "c", parentId: "a" }),
    makeNode({ nodeId: "lonely" }),
  ];
  const groups = [{ rootId: "a", members: nodes.slice(0, 3) } as unknown as NodeGroup];

  it("is the zone the node heads, else the one it sits in", () => {
    expect(zoneRootFor(nodes, groups, "a")).toBe("a");
    expect(zoneRootFor(nodes, groups, "b")).toBe("a");
    expect(zoneRootFor(nodes, groups, "lonely")).toBeNull();
  });
});

describe("texToText spacing", () => {
  it("keeps a letter after a fraction apart from it and adds no second brackets round a root", () => {
    expect(texToText("\\frac{d}{dx}x^n")).toBe("d/dx xⁿ");
    expect(texToText("\\frac{x}{\\sqrt{x^2+1}}")).toBe("x/√(x²+1)");
    expect(texToText("\\frac{(a)+(b)}{2}")).toBe("((a)+(b))/2");
  });
});
