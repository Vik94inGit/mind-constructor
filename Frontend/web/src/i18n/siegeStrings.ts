import type { Language } from "./translations";
import type { Strategy } from "../utils/siege";

// Copy for the opponent's turn in discussion mode (map/SiegePanel.tsx and
// utils/siege.ts) — reached as `t.ui.siege`. `moves` is what the opponent
// actually writes on the map, so it reads as a voice in the discussion, not
// as app chrome.
export interface SiegeStrings {
  open: string;
  title: string;
  intro: string;
  attacker: string;
  invader: string;
  target: string;
  kingdom: string;
  castle: string;
  strategies: Record<Strategy, { name: string; hint: string }>;
  needsCastle: string;
  go: string;
  nothing: string;
  failed: string;
  done: (strategy: string, target: string) => string;
  /** Answering an attack with one of your own (SiegePanel, NodePanel's Attack tab). */
  strikeBack: string;
  strikeBackIntro: (name: string, heal: number) => string;
  noHolds: string;
  moves: Record<Strategy, (name: string) => string>;
  /** Ending the discussion (map/FinishControls.tsx, utils/finish.ts). */
  finish: {
    button: string;
    confirm: string;
    notYet: string;
    waiting: (names: string) => string;
    agree: string;
    agreed: string;
    agreedCount: (agreed: number, total: number) => string;
    finished: (standing: number, fallen: number) => string;
    closed: string;
    replay: string;
    reopen: string;
    opponentMove: string;
  };
  /** The discussion's kept changes (map/HistoryPanel.tsx). */
  history: {
    open: string;
    title: string;
    intro: string;
    empty: string;
    loading: string;
    failed: string;
    edited: string;
    deleted: string;
    typeChanged: (from: string, to: string) => string;
    titleChanged: string;
    show: string;
  };
}

const en: SiegeStrings = {
  open: "Opponent's turn — let an imitated opponent attack one of your castles",
  title: "Opponent's turn",
  intro: "Your zones are castles, and the outermost one is the kingdom. Pick who attacks, which castle, and how.",
  attacker: "Who attacks",
  invader: "An invader from outside",
  target: "Which castle",
  kingdom: "Kingdom",
  castle: "Castle",
  strategies: {
    siege: { name: "Siege", hint: "A question on an outer node that has been asked the least" },
    undermine: { name: "Undermining", hint: "Doubts the assumption under the keep" },
    assault: { name: "Assault on the breach", hint: "A fatal flaw on the weakest unshielded node" },
    sally: { name: "Sally", hint: "Strikes back at the latest attack on its own castle" },
    fortify: { name: "Fortify", hint: "Shields its own keep instead of attacking" },
  },
  needsCastle: "Needs an attacking castle",
  go: "Make the move",
  nothing: "Nothing to do with that strategy here — try another one.",
  failed: "The opponent's move didn't go through",
  done: (strategy, target) => `${strategy}: "${target}". Your turn.`,
  strikeBack: "⚔ Strike back",
  strikeBackIntro: (name, heal) =>
    `This attack hit your "${name}". Answer it with your own: every hit on it heals "${name}" by ${heal}.`,
  noHolds: "No castles yet: a node with two or more nodes under it makes a zone, and every zone is a castle.",
  moves: {
    siege: (name) => `How do you know that "${name}" is true?`,
    undermine: (name) => `What if the reason behind "${name}" isn't true at all?`,
    assault: (name) => `"${name}" is where the whole plan breaks.`,
    sally: (name) => `This objection doesn't hold: "${name}"`,
    fortify: (name) => `We hold "${name}".`,
  },
  finish: {
    button: "Finish the discussion",
    confirm: "Finish this discussion? New points close until you reopen it.",
    notYet: "Your point was the last one. Let the opponent answer first, or finish once everyone agrees.",
    waiting: (names) => `Still waiting for: ${names}`,
    agree: "Agree to finish the discussion",
    agreed: "You agreed to finish. Press again to take it back.",
    agreedCount: (agreed, total) => `${agreed} of ${total} agreed to finish`,
    finished: (standing, fallen) => `The discussion is finished: ${standing} standing, ${fallen} fallen.`,
    closed: "New points are closed until the owner reopens it.",
    replay: "Watch the replay",
    reopen: "Reopen",
    opponentMove: "The opponent's move",
  },
  history: {
    open: "History — every change in this discussion",
    title: "History",
    intro: "Every edit and deletion in this discussion is kept here for everyone. Nothing can be removed from it.",
    empty: "No changes yet.",
    loading: "Loading…",
    failed: "Couldn't load the history.",
    edited: "edited",
    deleted: "deleted",
    typeChanged: (from, to) => `type: ${from} → ${to}`,
    titleChanged: "title",
    show: "Show on the map",
  },
};

// Only English ships in the main bundle; the other languages live in
// locales/<language>.ts and load when picked (translations.ts loadTranslation).
export const SIEGE_STRINGS: { en: SiegeStrings } = { en };
