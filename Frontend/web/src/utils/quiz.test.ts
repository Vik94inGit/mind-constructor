import { describe, expect, it } from "vitest";
import { parseQuizMarks, quizCards, roundOrder, roundTally } from "./quiz";
import type { NodeDoc } from "../types";

const node = (nodeId: string, fields: Partial<NodeDoc> = {}): NodeDoc =>
  ({ nodeId, mapId: "m", type: "Idea", text: "", parentId: null, ...fields }) as NodeDoc;

describe("quizCards", () => {
  it("asks a parent and answers with its children", () => {
    const cards = quizCards([
      node("p", { text: "Causes of WW1" }),
      node("a", { text: "Alliances", parentId: "p" }),
      node("b", { title: "Militarism", text: "Arms race", parentId: "p" }),
    ]);
    expect(cards[0]).toEqual({ nodeId: "p", question: "Causes of WW1", answerList: ["Alliances", "Militarism"] });
  });

  it("asks a title and answers with the text", () => {
    expect(quizCards([node("n", { title: "Photosynthesis", text: "Light into sugar" })])).toEqual([
      { nodeId: "n", question: "Photosynthesis", answer: "Light into sugar" },
    ]);
  });

  it("keeps a parent's own text with the children", () => {
    const [card] = quizCards([node("p", { title: "Newton", text: "Three laws" }), node("c", { text: "Inertia", parentId: "p" })]);
    expect(card).toEqual({ nodeId: "p", question: "Newton", answer: "Three laws", answerList: ["Inertia"] });
  });

  it("asks an answered ghost's question", () => {
    expect(quizCards([node("g", { prompt: "What is the goal?", text: "Pass the exam" })])).toEqual([
      { nodeId: "g", question: "What is the goal?", answer: "Pass the exam" },
    ]);
  });

  it("makes no card from a node with nothing to hide", () => {
    expect(quizCards([node("n", { text: "Just a note" }), node("e", { prompt: "Empty ghost?", ghost: true })])).toEqual([]);
  });

  it("drops empty children from the answer and skips a parent left with none", () => {
    expect(quizCards([node("p", { text: "Q" }), node("c", { text: "  ", parentId: "p" })])).toEqual([]);
  });
});

describe("roundOrder", () => {
  const cards = ["a", "b", "c", "d"].map((id) => ({ nodeId: id, question: id, answer: id }));
  it("puts what isn't known yet first, keeping map order within each mark", () => {
    const order = roundOrder(cards, { a: "know", b: "shaky", d: "notYet" }).map((c) => c.nodeId);
    expect(order).toEqual(["d", "b", "c", "a"]);
  });
  it("keeps only not yet and shaky for going over the shaky ones", () => {
    expect(roundOrder(cards, { a: "know", b: "shaky", d: "notYet" }, true).map((c) => c.nodeId)).toEqual(["d", "b"]);
  });
});

describe("roundTally", () => {
  it("counts the marks given", () => {
    expect(roundTally({ a: "know", b: "know", c: "shaky" })).toEqual({ notYet: 0, shaky: 1, know: 2 });
  });
});

describe("parseQuizMarks", () => {
  it("drops anything that isn't a mark", () => {
    expect(parseQuizMarks({ a: "know", b: "great", c: 3 })).toEqual({ a: "know" });
    expect(parseQuizMarks(null)).toEqual({});
  });
});
