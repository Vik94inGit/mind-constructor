import type { Language } from "./translations";
import type { Feeling } from "../utils/feeling";

// Copy for feelings on thoughts and the before/after check-in (utils/feeling.ts)
// — reached as `t.ui.feelings`. Warm and plain; nothing here grades anyone.
export interface FeelingStrings {
  names: Record<Feeling, string>;
  /** The node panel's row and the context menu's drill-down. */
  label: string;
  question: string;
  none: string;
  privateHint: string;
  badge: (name: string) => string;
  /** The Write step of Think it through, after each new thought. */
  thoughtQuestion: (text: string) => string;
  skip: string;
  /** The check-in. */
  before: string;
  beforeHint: string;
  after: string;
  afterHint: string;
  beforeWas: (before: string) => string;
  strength: string;
  strengthLow: string;
  strengthHigh: string;
  strengthValue: (n: number) => string;
  save: string;
  notNow: string;
  shift: (shift: string) => string;
  calmer: string;
  close: string;
  /** The dashboard's map menu. */
  checkInNow: string;
  checkInFailed: string;
}

const en: FeelingStrings = {
  names: {
    worried: "Worried",
    anxious: "Anxious",
    scared: "Scared",
    sad: "Sad",
    angry: "Angry",
    frustrated: "Frustrated",
    confused: "Confused",
    tired: "Tired",
    curious: "Curious",
    hopeful: "Hopeful",
    excited: "Excited",
    happy: "Happy",
    proud: "Proud",
    grateful: "Grateful",
    calm: "Calm",
    relieved: "Relieved",
  },
  label: "Feeling",
  question: "How does this feel?",
  none: "None",
  privateHint: "Only you see your feelings.",
  badge: (name) => `You feel: ${name}`,
  thoughtQuestion: (text) => `How does “${text}” feel?`,
  skip: "Skip",
  before: "How do you feel about this right now?",
  beforeHint: "Optional. You'll be asked again later, so you can see what thinking it through did.",
  after: "And now? How do you feel about it?",
  afterHint: "Only you see this.",
  beforeWas: (before) => `Before: ${before}`,
  strength: "How strong?",
  strengthLow: "a little",
  strengthHigh: "very",
  strengthValue: (n) => `${n} of 5`,
  save: "Save",
  notNow: "Not now",
  shift: (shift) => `You went ${shift}.`,
  calmer: "Nice work thinking it through.",
  close: "Close",
  checkInNow: "How do you feel now?",
  checkInFailed: "Couldn't save how you feel. Try again.",
};

// Only English ships in the main bundle; the other languages live in
// locales/<language>.ts and load when picked (translations.ts loadTranslation).
export const FEELING_STRINGS: { en: FeelingStrings } = { en };
