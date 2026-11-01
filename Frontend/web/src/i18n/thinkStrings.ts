import type { Language } from "./translations";
import type { MapKind } from "../types";
import type { PromptKey } from "../utils/thoughtFlow";

// Copy for the "Think it through" flow (pages/ThinkPage.tsx) and its entry
// card on the dashboard — reached as `t.ui.think`. Kept in its own file only
// because there's a lot of it; same rules as uiStrings.ts. The tone is on
// purpose warm and low-stakes: the flow exists to get people writing, so it
// never grades, only nudges.
export interface ThinkStrings {
  entry: {
    title: string;
    hint: string;
    placeholder: string;
    start: string;
    resume: (count: number) => string;
  };
  steps: { start: string; write: string; shape: string; build: string };
  stepOf: (n: number, total: number) => string;
  back: string;
  next: string;
  startOver: string;
  startOverConfirm: string;
  saved: string;
  start: {
    title: string;
    hint: string;
    kindQuestion: string;
    centerLabel: string;
    kinds: Record<MapKind, { label: string; placeholder: string }>;
  };
  write: {
    title: string;
    hint: string;
    placeholder: string;
    add: string;
    nextQuestion: string;
    prevQuestion: string;
    questionOf: (n: number, total: number) => string;
    allAnswered: string;
    encourage: (count: number) => string;
    count: (count: number) => string;
    remove: string;
  };
  prompts: Record<PromptKey, string>;
  shape: {
    title: string;
    hint: string;
    hangsFrom: string;
    center: string;
    remove: string;
    add: string;
    newThought: string;
    empty: string;
  };
  build: {
    title: string;
    hint: string;
    name: string;
    personal: { label: string; hint: string };
    discussion: { label: string; hint: string };
    summary: (count: number) => string;
    submit: string;
    building: (done: number, total: number) => string;
    error: string;
  };
  preview: string;
  centerFirst: string;
}

const en: ThinkStrings = {
  entry: {
    title: "What's on your mind?",
    hint: "Write it down in your own words — we'll help you untangle it into a map, one thought at a time.",
    placeholder: "e.g. I can't decide whether to change jobs",
    start: "Start thinking",
    resume: (n) => `Continue where you left off (${n} ${n === 1 ? "thought" : "thoughts"})`,
  },
  steps: { start: "Start", write: "Write", shape: "Shape", build: "Map it" },
  stepOf: (n, total) => `Step ${n} of ${total}`,
  back: "Back",
  next: "Next",
  startOver: "Start over",
  startOverConfirm: "Throw away this draft and start over?",
  saved: "Saved in this browser",
  start: {
    title: "What's on your mind?",
    hint: "Write the one thought everything else hangs from. A sentence is plenty — you can change it later.",
    kindQuestion: "What kind of thinking is this?",
    centerLabel: "Your central thought",
    kinds: {
      problem: { label: "I'm stuck on something", placeholder: "e.g. I keep running out of time for what matters" },
      decision: { label: "I need to decide", placeholder: "e.g. Should I move to another city?" },
      goal: { label: "I want to get somewhere", placeholder: "e.g. Run a half marathon by spring" },
      retro: { label: "Something happened", placeholder: "e.g. How the product launch went" },
      idea: { label: "I have an idea", placeholder: "e.g. A weekly swap market for kids' clothes" },
    },
  },
  write: {
    title: "Let it out",
    hint: "Answer in short thoughts, one at a time. There are no wrong answers — write it the way you'd say it.",
    placeholder: "Write a thought and press Enter",
    add: "Add",
    nextQuestion: "Next question",
    prevQuestion: "Previous question",
    questionOf: (n, total) => `Question ${n} of ${total}`,
    allAnswered: "That's every question. Keep adding, or move on to shape what you wrote.",
    encourage: (n) =>
      n === 0
        ? "Start with whatever comes first."
        : n < 3
          ? "Good start. What else?"
          : n < 6
            ? "You're on a roll."
            : n < 10
              ? "That's a lot of clarity already."
              : "Wonderful — this will be a rich map.",
    count: (n) => `${n} ${n === 1 ? "thought" : "thoughts"}`,
    remove: "Remove",
  },
  prompts: {
    whyHard: "What makes it hard?",
    tried: "What have you already tried?",
    couldDo: "What could you do about it?",
    solved: "What would it look like once it's solved?",
    doNothing: "What happens if you do nothing?",
    unknowns: "What don't you know yet?",
    options: "What are your options?",
    matters: "What matters most to you here?",
    bestCase: "What's the best that could happen?",
    worries: "What worries you?",
    leaning: "Which way are you leaning, and why?",
    howKnow: "How will you know you got there?",
    firstStep: "What's one small step you could take?",
    inTheWay: "What could get in the way?",
    helps: "What would help you?",
    ifNot: "What if it doesn't work out?",
    wentWell: "What went well?",
    wentBad: "What didn't go well?",
    whyHappened: "Why did it happen that way?",
    nextTime: "What will you try next time?",
    ideaFor: "Who is it for, and what does it solve for them?",
    ideaWorks: "How would it work?",
    ideaTryFirst: "What is the smallest way to try it?",
    ideaShows: "What would show that it works?",
    ideaKill: "What could kill it?",
    anythingElse: "Anything else on your mind?",
  },
  shape: {
    title: "Shape your thoughts",
    hint: "Check what each thought is and what it hangs from. Most are already sorted — just adjust what feels off.",
    hangsFrom: "Hangs from",
    center: "Your central thought",
    remove: "Remove",
    add: "+ Add a thought",
    newThought: "New thought",
    empty: "No thoughts yet — go back and write a few, or add one here.",
  },
  build: {
    title: "Turn it into a map",
    hint: "Give it a name and decide who it's for. You can keep adding to it on the map.",
    name: "Map name",
    personal: { label: "Just for me", hint: "A private space to think. You can still invite people later." },
    discussion: { label: "Open for discussion", hint: "Invite others to challenge and add to your thoughts." },
    summary: (n) => `Your central thought and ${n} ${n === 1 ? "thought" : "thoughts"} around it`,
    submit: "Build my map",
    building: (done, total) => `Placing ${done} of ${total}…`,
    error: "Couldn't build the map. Your thoughts are still saved — try again.",
  },
  preview: "Your map so far",
  centerFirst: "Write your central thought first.",
};

// Only English ships in the main bundle; the other languages live in
// locales/<language>.ts and load when picked (translations.ts loadTranslation).
export const THINK_STRINGS: { en: ThinkStrings } = { en };
