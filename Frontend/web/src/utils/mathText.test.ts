import { describe, expect, it } from "vitest";
import { hasMath, splitMath } from "./mathText";

describe("splitMath", () => {
  it("leaves text with no formula as one plain piece", () => {
    expect(splitMath("Just a thought")).toEqual([{ kind: "text", value: "Just a thought" }]);
    expect(splitMath("")).toEqual([{ kind: "text", value: "" }]);
  });

  it("finds $…$ inside a sentence", () => {
    expect(splitMath("Energy $E=mc^2$ is mass")).toEqual([
      { kind: "text", value: "Energy " },
      { kind: "math", tex: "E=mc^2", display: false },
      { kind: "text", value: " is mass" },
    ]);
  });

  it("finds $$…$$ and \\[…\\] as formulas on their own line", () => {
    expect(splitMath("$$a^2+b^2=c^2$$")).toEqual([{ kind: "math", tex: "a^2+b^2=c^2", display: true }]);
    expect(splitMath("so \\[ \\int_0^1 x\\,dx \\] done")).toEqual([
      { kind: "text", value: "so " },
      { kind: "math", tex: "\\int_0^1 x\\,dx", display: true },
      { kind: "text", value: " done" },
    ]);
  });

  it("finds \\(…\\) as ChatGPT copies it", () => {
    expect(splitMath("where \\(x \\neq 0\\).")).toEqual([
      { kind: "text", value: "where " },
      { kind: "math", tex: "x \\neq 0", display: false },
      { kind: "text", value: "." },
    ]);
  });

  it("finds Wikipedia's {\\displaystyle …} with nested braces", () => {
    expect(splitMath("E = mc2 {\\displaystyle E=mc^{2}}")).toEqual([
      { kind: "text", value: "E = mc2 " },
      { kind: "math", tex: "E=mc^{2}", display: false },
    ]);
  });

  it("doesn't take money for a formula", () => {
    expect(hasMath("It costs $5 and $10 now")).toBe(false);
    expect(hasMath("Between $ 3 and 4 $")).toBe(false);
    expect(hasMath("Price: $20, tip $3")).toBe(false);
  });

  it("keeps an escaped \\$ as text", () => {
    expect(hasMath("a \\$x\\$ b")).toBe(false);
  });

  it("leaves an unclosed marker as text", () => {
    expect(splitMath("half $x+1")).toEqual([{ kind: "text", value: "half $x+1" }]);
    expect(splitMath("open \\( never")).toEqual([{ kind: "text", value: "open \\( never" }]);
    expect(splitMath("$$ $$")).toEqual([{ kind: "text", value: "$$ $$" }]);
  });

  it("doesn't run a $ formula across paragraphs", () => {
    expect(hasMath("$a\n\nb$")).toBe(false);
  });
});

describe("hasMath", () => {
  it("is false for empty or missing text", () => {
    expect(hasMath(undefined)).toBe(false);
    expect(hasMath("")).toBe(false);
    expect(hasMath("no markers here")).toBe(false);
  });
  it("is true for any recognized formula", () => {
    expect(hasMath("$x$")).toBe(true);
    expect(hasMath("\\(x\\)")).toBe(true);
  });
});
