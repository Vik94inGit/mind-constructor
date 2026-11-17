import { describe, expect, it } from "vitest";
import { canTurnPromptIntoQuestion, questionSpot } from "./promptQuestion";
import { NODE_FOOTPRINT } from "./canvasLayout";
import type { NodeDoc } from "../types";

const node = (over: Partial<NodeDoc>): NodeDoc => ({ nodeId: "a", type: "Definition", text: "", prompt: "", parentId: null, ...over }) as NodeDoc;

describe("canTurnPromptIntoQuestion", () => {
  it("offers it once a prompted ghost is answered", () => {
    const n = node({ prompt: "What is a cell?", text: "The unit of life" });
    expect(canTurnPromptIntoQuestion(n, [n])).toBe(true);
  });
  it("counts a title as an answer too", () => {
    const n = node({ prompt: "What is a cell?", title: "Unit of life" });
    expect(canTurnPromptIntoQuestion(n, [n])).toBe(true);
  });
  it("needs a prompt and an answer", () => {
    expect(canTurnPromptIntoQuestion(node({ text: "x" }), [])).toBe(false);
    expect(canTurnPromptIntoQuestion(node({ prompt: "Why?", text: "  " }), [])).toBe(false);
  });
  it("leaves attacks and shields alone", () => {
    expect(canTurnPromptIntoQuestion(node({ prompt: "Why?", text: "x", isWeapon: true }), [])).toBe(false);
    expect(canTurnPromptIntoQuestion(node({ prompt: "Why?", text: "x", isProtection: true }), [])).toBe(false);
  });
  it("isn't offered again once the question hangs above it", () => {
    const q = node({ nodeId: "q", type: "Question", text: "what is a cell? " });
    const n = node({ prompt: "What is a cell?", text: "The unit of life", parentId: "q" });
    expect(canTurnPromptIntoQuestion(n, [q, n])).toBe(false);
  });
  it("is still offered under a different question", () => {
    const q = node({ nodeId: "q", type: "Question", text: "Something else" });
    const n = node({ prompt: "What is a cell?", text: "The unit of life", parentId: "q" });
    expect(canTurnPromptIntoQuestion(n, [q, n])).toBe(true);
  });
});

describe("questionSpot", () => {
  it("sits between the answer and its parent", () => {
    expect(questionSpot({ x: 100, y: 300 }, { x: 300, y: 100 })).toEqual({ x: 200, y: 200 });
  });
  it("sits above the answer when it has no parent", () => {
    expect(questionSpot({ x: 100, y: 300 }, null)).toEqual({ x: 100, y: 300 - NODE_FOOTPRINT.h * 1.5 });
  });
});
