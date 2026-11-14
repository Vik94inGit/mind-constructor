import { describe, expect, it } from "vitest";
import { parseQuizMarks, quizCards, roundOrder, roundTally } from "./quiz";
import type { NodeDoc } from "../types";

const node = (nodeId: string, fields: Partial<NodeDoc> = {}): NodeDoc =>
  ({ nodeId, mapId: "m", type: "Idea", text: "", parentId: null, ...fields }) as NodeDoc;

describe("quizCards", () => {
  it("asks a ❓, a problem or a goal and answers with its ✅ children", () => {
    const cards = quizCards([
      node("q", { type: "unknown", text: "Causes of WW1" }),
      node("a", { type: "Success", text: "Alliances", parentId: "q" }),
      node("b", { type: "Success", title: "Militarism", text: "Arms race", parentId: "q" }),
      node("p", { type: "Problem", title: "Slow build" }),
      node("c", { type: "Success", text: "Cache deps", parentId: "p" }),
      node("g", { type: "Solution", prompt: "What is the goal?", text: "Pass the exam" }),
      node("d", { type: "Success", text: "Study daily", parentId: "g" }),
    ]);
    expect(cards).toEqual([
      { nodeId: "q", question: "Causes of WW1", answerList: ["Alliances", "Militarism"] },
      { nodeId: "p", question: "Slow build", answerList: ["Cache deps"] },
      { nodeId: "g", question: "Pass the exam", answerList: ["Study daily"] },
    ]);
  });

  it("leaves children that aren't ✅ out of the answer", () => {
    const [card] = quizCards([
      node("q", { type: "unknown", text: "Why?" }),
      node("i", { type: "Idea", text: "Maybe this", parentId: "q" }),
      node("s", { type: "Success", text: "Because", parentId: "q" }),
    ]);
    expect(card).toEqual({ nodeId: "q", question: "Why?", answerList: ["Because"] });
  });

  it("makes no card from other types, even with a title, text or ✅ children", () => {
    expect(
      quizCards([
        node("n", { type: "Idea", title: "Photosynthesis", text: "Light into sugar" }),
        node("o", { type: "Option", text: "Go by train" }),
        node("s", { type: "Success", text: "Booked", parentId: "o" }),
      ]),
    ).toEqual([]);
  });

  it("makes no card from an asking node without a ✅ answer", () => {
    expect(
      quizCards([
        node("q", { type: "unknown", title: "Title", text: "Text" }),
        node("p", { type: "Problem", text: "Q" }),
        node("c", { type: "Success", text: "  ", parentId: "p" }),
      ]),
    ).toEqual([]);
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
