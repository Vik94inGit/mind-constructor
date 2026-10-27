import { describe, expect, it } from "vitest";
import { filterNodes, isFiltering, toggleType } from "./nodeFilter";
import type { NodeType } from "../types";

const node = (type: NodeType, text: string, extra: { title?: string; zoneName?: string } = {}) => ({ type, text, ...extra });

describe("filterNodes", () => {
  const nodes = [
    node("Idea", "Swap market for kids' clothes"),
    node("Problem", "No time on weekends", { zoneName: "Království" }),
    node("Idea", "Weekend reading club", { title: "Club" }),
    node("Fail", "Nobody came"),
  ];

  it("keeps everything when nothing is typed or picked", () => {
    expect(filterNodes(nodes, "  ", [])).toHaveLength(4);
  });

  it("keeps only the picked types", () => {
    expect(filterNodes(nodes, "", ["Idea"]).map((n) => n.text)).toEqual([
      "Swap market for kids' clothes",
      "Weekend reading club",
    ]);
    expect(filterNodes(nodes, "", ["Idea", "Fail"])).toHaveLength(3);
  });

  it("needs both the words and the type", () => {
    expect(filterNodes(nodes, "weekend", []).map((n) => n.type)).toEqual(["Problem", "Idea"]);
    expect(filterNodes(nodes, "weekend", ["Idea"]).map((n) => n.title)).toEqual(["Club"]);
  });

  it("matches titles and zone names without case or accents", () => {
    expect(filterNodes(nodes, "kralovstvi", [])).toHaveLength(1);
    expect(filterNodes(nodes, "CLUB", ["Idea"])).toHaveLength(1);
  });
});

describe("isFiltering", () => {
  it("is on with words or with types", () => {
    expect(isFiltering("", [])).toBe(false);
    expect(isFiltering(" x ", [])).toBe(true);
    expect(isFiltering("", ["Idea"])).toBe(true);
  });
});

describe("toggleType", () => {
  it("adds and removes a type", () => {
    expect(toggleType(["Idea"], "Fail")).toEqual(["Idea", "Fail"]);
    expect(toggleType(["Idea", "Fail"], "Idea")).toEqual(["Fail"]);
  });
});
