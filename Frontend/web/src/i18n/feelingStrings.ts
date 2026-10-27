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

const cs: FeelingStrings = {
  names: {
    worried: "Obavy",
    anxious: "Úzkost",
    scared: "Strach",
    sad: "Smutek",
    angry: "Vztek",
    frustrated: "Frustrace",
    confused: "Zmatek",
    tired: "Únava",
    curious: "Zvědavost",
    hopeful: "Naděje",
    excited: "Nadšení",
    happy: "Radost",
    proud: "Hrdost",
    grateful: "Vděčnost",
    calm: "Klid",
    relieved: "Úleva",
  },
  label: "Pocit",
  question: "Jaký z toho máš pocit?",
  none: "Žádný",
  privateHint: "Své pocity vidíš jen ty.",
  badge: (name) => `Tvůj pocit: ${name}`,
  thoughtQuestion: (text) => `Jaký pocit máš z „${text}“?`,
  skip: "Přeskočit",
  before: "Jak se kvůli tomu cítíš právě teď?",
  beforeHint: "Nepovinné. Později se zeptáme znovu, ať vidíš, co s tebou promyšlení udělalo.",
  after: "A teď? Jak se kvůli tomu cítíš?",
  afterHint: "Vidíš to jen ty.",
  beforeWas: (before) => `Předtím: ${before}`,
  strength: "Jak silně?",
  strengthLow: "trochu",
  strengthHigh: "hodně",
  strengthValue: (n) => `${n} z 5`,
  save: "Uložit",
  notNow: "Teď ne",
  shift: (shift) => `Posun: ${shift}.`,
  calmer: "Dobrá práce, že sis to promyslel(a).",
  close: "Zavřít",
  checkInNow: "Jak se cítíš teď?",
  checkInFailed: "Pocit se nepodařilo uložit. Zkus to znovu.",
};

const uk: FeelingStrings = {
  names: {
    worried: "Тривога",
    anxious: "Неспокій",
    scared: "Страх",
    sad: "Сум",
    angry: "Злість",
    frustrated: "Роздратування",
    confused: "Розгубленість",
    tired: "Втома",
    curious: "Цікавість",
    hopeful: "Надія",
    excited: "Захват",
    happy: "Радість",
    proud: "Гордість",
    grateful: "Вдячність",
    calm: "Спокій",
    relieved: "Полегшення",
  },
  label: "Почуття",
  question: "Що ти відчуваєш щодо цього?",
  none: "Немає",
  privateHint: "Свої почуття бачиш лише ти.",
  badge: (name) => `Ти відчуваєш: ${name}`,
  thoughtQuestion: (text) => `Що ти відчуваєш щодо «${text}»?`,
  skip: "Пропустити",
  before: "Що ти відчуваєш щодо цього просто зараз?",
  beforeHint: "Необов'язково. Згодом ми спитаємо знову, щоб ти побачив(ла), що дало обдумування.",
  after: "А тепер? Що ти відчуваєш щодо цього?",
  afterHint: "Це бачиш лише ти.",
  beforeWas: (before) => `Раніше: ${before}`,
  strength: "Наскільки сильно?",
  strengthLow: "трохи",
  strengthHigh: "дуже",
  strengthValue: (n) => `${n} з 5`,
  save: "Зберегти",
  notNow: "Не зараз",
  shift: (shift) => `Зміна: ${shift}.`,
  calmer: "Гарна робота — ти це обдумав(ла).",
  close: "Закрити",
  checkInNow: "Що ти відчуваєш тепер?",
  checkInFailed: "Не вдалося зберегти почуття. Спробуй ще раз.",
};

const ru: FeelingStrings = {
  names: {
    worried: "Тревога",
    anxious: "Беспокойство",
    scared: "Страх",
    sad: "Грусть",
    angry: "Злость",
    frustrated: "Раздражение",
    confused: "Растерянность",
    tired: "Усталость",
    curious: "Любопытство",
    hopeful: "Надежда",
    excited: "Восторг",
    happy: "Радость",
    proud: "Гордость",
    grateful: "Благодарность",
    calm: "Спокойствие",
    relieved: "Облегчение",
  },
  label: "Чувство",
  question: "Что ты чувствуешь по этому поводу?",
  none: "Нет",
  privateHint: "Свои чувства видишь только ты.",
  badge: (name) => `Ты чувствуешь: ${name}`,
  thoughtQuestion: (text) => `Что ты чувствуешь насчёт «${text}»?`,
  skip: "Пропустить",
  before: "Что ты чувствуешь по этому поводу прямо сейчас?",
  beforeHint: "Необязательно. Позже мы спросим снова, чтобы ты увидел(а), что дало обдумывание.",
  after: "А теперь? Что ты чувствуешь по этому поводу?",
  afterHint: "Это видишь только ты.",
  beforeWas: (before) => `Раньше: ${before}`,
  strength: "Насколько сильно?",
  strengthLow: "немного",
  strengthHigh: "очень",
  strengthValue: (n) => `${n} из 5`,
  save: "Сохранить",
  notNow: "Не сейчас",
  shift: (shift) => `Сдвиг: ${shift}.`,
  calmer: "Хорошая работа — ты это обдумал(а).",
  close: "Закрыть",
  checkInNow: "Что ты чувствуешь теперь?",
  checkInFailed: "Не удалось сохранить чувство. Попробуй ещё раз.",
};

export const FEELING_STRINGS: Record<Language, FeelingStrings> = { en, cs, uk, ru };
