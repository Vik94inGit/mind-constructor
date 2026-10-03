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

const cs: ThinkStrings = {
  entry: {
    title: "Co vám leží v hlavě?",
    hint: "Napište to vlastními slovy — pomůžeme vám to rozplést do mapy, myšlenku po myšlence.",
    placeholder: "např. Nemůžu se rozhodnout, jestli změnit práci",
    start: "Začít přemýšlet",
    resume: (n) => `Pokračovat, kde jste skončili (${n} ${n === 1 ? "myšlenka" : n >= 2 && n <= 4 ? "myšlenky" : "myšlenek"})`,
  },
  steps: { start: "Začátek", write: "Psaní", shape: "Třídění", build: "Mapa" },
  stepOf: (n, total) => `Krok ${n} z ${total}`,
  back: "Zpět",
  next: "Dál",
  startOver: "Začít znovu",
  startOverConfirm: "Zahodit tento koncept a začít znovu?",
  saved: "Uloženo v tomto prohlížeči",
  start: {
    title: "Co vám leží v hlavě?",
    hint: "Napište jednu myšlenku, ze které vychází všechno ostatní. Stačí jedna věta — později ji můžete změnit.",
    kindQuestion: "O jaké přemýšlení jde?",
    centerLabel: "Vaše hlavní myšlenka",
    kinds: {
      problem: { label: "Na něčem jsem se zasekl/a", placeholder: "např. Pořád mi nezbývá čas na to důležité" },
      decision: { label: "Potřebuji se rozhodnout", placeholder: "např. Mám se přestěhovat do jiného města?" },
      goal: { label: "Chci něčeho dosáhnout", placeholder: "např. Do jara uběhnout půlmaraton" },
      retro: { label: "Něco se stalo", placeholder: "např. Jak proběhlo spuštění produktu" },
    },
  },
  write: {
    title: "Pusťte to ven",
    hint: "Odpovídejte krátkými myšlenkami, jednou po druhé. Špatné odpovědi neexistují — pište, jak byste to řekli.",
    placeholder: "Napište myšlenku a stiskněte Enter",
    add: "Přidat",
    nextQuestion: "Další otázka",
    prevQuestion: "Předchozí otázka",
    questionOf: (n, total) => `Otázka ${n} z ${total}`,
    allAnswered: "To jsou všechny otázky. Přidávejte dál, nebo pokračujte k třídění.",
    encourage: (n) =>
      n === 0
        ? "Začněte tím, co vás napadne první."
        : n < 3
          ? "Dobrý začátek. Co dál?"
          : n < 6
            ? "Jde vám to skvěle."
            : n < 10
              ? "Už je v tom hodně jasno."
              : "Výborně — bude z toho bohatá mapa.",
    count: (n) => `${n} ${n === 1 ? "myšlenka" : n >= 2 && n <= 4 ? "myšlenky" : "myšlenek"}`,
    remove: "Odebrat",
  },
  prompts: {
    whyHard: "Co to dělá těžkým?",
    tried: "Co jste už zkusili?",
    couldDo: "Co byste s tím mohli udělat?",
    solved: "Jak to bude vypadat, až to bude vyřešené?",
    doNothing: "Co se stane, když nic neuděláte?",
    unknowns: "Co ještě nevíte?",
    options: "Jaké máte možnosti?",
    matters: "Na čem vám tu nejvíc záleží?",
    bestCase: "Co nejlepšího se může stát?",
    worries: "Čeho se obáváte?",
    leaning: "Ke které možnosti se přikláníte a proč?",
    howKnow: "Jak poznáte, že jste u cíle?",
    firstStep: "Jaký malý krok můžete udělat?",
    inTheWay: "Co vám může stát v cestě?",
    helps: "Co by vám pomohlo?",
    ifNot: "Co když to nevyjde?",
    wentWell: "Co se povedlo?",
    wentBad: "Co se nepovedlo?",
    whyHappened: "Proč to dopadlo právě takhle?",
    nextTime: "Co zkusíte příště?",
    anythingElse: "Napadá vás ještě něco?",
  },
  shape: {
    title: "Utřiďte své myšlenky",
    hint: "Zkontrolujte, čím každá myšlenka je a z čeho vychází. Většina je už roztříděná — upravte jen to, co nesedí.",
    hangsFrom: "Vychází z",
    center: "Vaše hlavní myšlenka",
    remove: "Odebrat",
    add: "+ Přidat myšlenku",
    newThought: "Nová myšlenka",
    empty: "Zatím žádné myšlenky — vraťte se a pár jich napište, nebo je přidejte tady.",
  },
  build: {
    title: "Udělejte z toho mapu",
    hint: "Pojmenujte ji a rozhodněte, pro koho je. Na mapě pak můžete přidávat dál.",
    name: "Název mapy",
    personal: { label: "Jen pro mě", hint: "Soukromý prostor k přemýšlení. Lidi můžete pozvat i později." },
    discussion: { label: "K diskusi", hint: "Pozvěte ostatní, aby vaše myšlenky zpochybnili a doplnili." },
    summary: (n) => `Vaše hlavní myšlenka a ${n} ${n === 1 ? "myšlenka" : n >= 2 && n <= 4 ? "myšlenky" : "myšlenek"} kolem ní`,
    submit: "Vytvořit mapu",
    building: (done, total) => `Umisťuji ${done} z ${total}…`,
    error: "Mapu se nepodařilo vytvořit. Vaše myšlenky zůstaly uložené — zkuste to znovu.",
  },
  preview: "Vaše mapa zatím",
  centerFirst: "Nejdřív napište hlavní myšlenku.",
};

const ukThoughts = (n: number) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "думка";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "думки";
  return "думок";
};

const uk: ThinkStrings = {
  entry: {
    title: "Що у вас на думці?",
    hint: "Запишіть це своїми словами — ми допоможемо розплутати це в карту, думка за думкою.",
    placeholder: "напр. Не можу вирішити, чи змінювати роботу",
    start: "Почати думати",
    resume: (n) => `Продовжити з того місця (${n} ${ukThoughts(n)})`,
  },
  steps: { start: "Початок", write: "Запис", shape: "Упорядкування", build: "Карта" },
  stepOf: (n, total) => `Крок ${n} з ${total}`,
  back: "Назад",
  next: "Далі",
  startOver: "Почати заново",
  startOverConfirm: "Викинути цю чернетку й почати заново?",
  saved: "Збережено в цьому браузері",
  start: {
    title: "Що у вас на думці?",
    hint: "Запишіть одну думку, від якої відходить усе інше. Вистачить одного речення — потім його можна змінити.",
    kindQuestion: "Про що ви думаєте?",
    centerLabel: "Ваша головна думка",
    kinds: {
      problem: { label: "Я застряг/ла на чомусь", placeholder: "напр. Мені постійно бракує часу на важливе" },
      decision: { label: "Мені треба вирішити", placeholder: "напр. Чи варто переїжджати в інше місто?" },
      goal: { label: "Я хочу чогось досягти", placeholder: "напр. Пробігти напівмарафон до весни" },
      retro: { label: "Щось сталося", placeholder: "напр. Як пройшов запуск продукту" },
    },
  },
  write: {
    title: "Випустіть це назовні",
    hint: "Відповідайте короткими думками, по одній. Неправильних відповідей немає — пишіть так, як сказали б.",
    placeholder: "Напишіть думку й натисніть Enter",
    add: "Додати",
    nextQuestion: "Наступне питання",
    prevQuestion: "Попереднє питання",
    questionOf: (n, total) => `Питання ${n} з ${total}`,
    allAnswered: "Це всі питання. Додавайте ще або переходьте до впорядкування.",
    encourage: (n) =>
      n === 0
        ? "Почніть з того, що спадає на думку першим."
        : n < 3
          ? "Гарний початок. Що ще?"
          : n < 6
            ? "У вас добре виходить."
            : n < 10
              ? "Уже чимало ясності."
              : "Чудово — вийде змістовна карта.",
    count: (n) => `${n} ${ukThoughts(n)}`,
    remove: "Прибрати",
  },
  prompts: {
    whyHard: "Що робить це складним?",
    tried: "Що ви вже пробували?",
    couldDo: "Що ви могли б з цим зробити?",
    solved: "Як це виглядатиме, коли буде вирішено?",
    doNothing: "Що станеться, якщо нічого не робити?",
    unknowns: "Чого ви ще не знаєте?",
    options: "Які у вас є варіанти?",
    matters: "Що для вас тут найважливіше?",
    bestCase: "Що найкраще може статися?",
    worries: "Що вас турбує?",
    leaning: "До чого ви схиляєтеся і чому?",
    howKnow: "Як ви зрозумієте, що досягли мети?",
    firstStep: "Який маленький крок ви можете зробити?",
    inTheWay: "Що може завадити?",
    helps: "Що вам допомогло б?",
    ifNot: "А якщо не вийде?",
    wentWell: "Що вдалося?",
    wentBad: "Що не вдалося?",
    whyHappened: "Чому сталося саме так?",
    nextTime: "Що спробуєте наступного разу?",
    anythingElse: "Щось іще на думці?",
  },
  shape: {
    title: "Упорядкуйте думки",
    hint: "Перевірте, чим є кожна думка і від чого вона відходить. Більшість уже впорядкована — виправте лише те, що не так.",
    hangsFrom: "Відходить від",
    center: "Ваша головна думка",
    remove: "Прибрати",
    add: "+ Додати думку",
    newThought: "Нова думка",
    empty: "Думок поки немає — поверніться й напишіть кілька або додайте тут.",
  },
  build: {
    title: "Перетворіть це на карту",
    hint: "Дайте їй назву й вирішіть, для кого вона. На карті можна додавати далі.",
    name: "Назва карти",
    personal: { label: "Лише для мене", hint: "Приватний простір для роздумів. Запросити людей можна й пізніше." },
    discussion: { label: "Для обговорення", hint: "Запросіть інших оскаржувати й доповнювати ваші думки." },
    summary: (n) => `Ваша головна думка і ${n} ${ukThoughts(n)} навколо неї`,
    submit: "Створити карту",
    building: (done, total) => `Розміщую ${done} з ${total}…`,
    error: "Не вдалося створити карту. Ваші думки збережено — спробуйте ще раз.",
  },
  preview: "Ваша карта зараз",
  centerFirst: "Спершу напишіть головну думку.",
};

const ruThoughts = (n: number) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "мысль";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "мысли";
  return "мыслей";
};

const ru: ThinkStrings = {
  entry: {
    title: "Что у вас на уме?",
    hint: "Запишите это своими словами — мы поможем распутать это в карту, мысль за мыслью.",
    placeholder: "напр. Не могу решить, менять ли работу",
    start: "Начать думать",
    resume: (n) => `Продолжить с того места (${n} ${ruThoughts(n)})`,
  },
  steps: { start: "Начало", write: "Запись", shape: "Порядок", build: "Карта" },
  stepOf: (n, total) => `Шаг ${n} из ${total}`,
  back: "Назад",
  next: "Далее",
  startOver: "Начать заново",
  startOverConfirm: "Выбросить этот черновик и начать заново?",
  saved: "Сохранено в этом браузере",
  start: {
    title: "Что у вас на уме?",
    hint: "Запишите одну мысль, от которой отходит всё остальное. Достаточно одного предложения — потом его можно изменить.",
    kindQuestion: "О чём вы думаете?",
    centerLabel: "Ваша главная мысль",
    kinds: {
      problem: { label: "Я на чём-то застрял/а", placeholder: "напр. Мне постоянно не хватает времени на важное" },
      decision: { label: "Мне нужно решить", placeholder: "напр. Стоит ли переезжать в другой город?" },
      goal: { label: "Я хочу чего-то достичь", placeholder: "напр. Пробежать полумарафон к весне" },
      retro: { label: "Что-то произошло", placeholder: "напр. Как прошёл запуск продукта" },
    },
  },
  write: {
    title: "Выпустите это наружу",
    hint: "Отвечайте короткими мыслями, по одной. Неправильных ответов нет — пишите так, как сказали бы.",
    placeholder: "Напишите мысль и нажмите Enter",
    add: "Добавить",
    nextQuestion: "Следующий вопрос",
    prevQuestion: "Предыдущий вопрос",
    questionOf: (n, total) => `Вопрос ${n} из ${total}`,
    allAnswered: "Это все вопросы. Добавляйте ещё или переходите к упорядочиванию.",
    encourage: (n) =>
      n === 0
        ? "Начните с того, что приходит в голову первым."
        : n < 3
          ? "Хорошее начало. Что ещё?"
          : n < 6
            ? "У вас отлично получается."
            : n < 10
              ? "Уже немало ясности."
              : "Прекрасно — получится содержательная карта.",
    count: (n) => `${n} ${ruThoughts(n)}`,
    remove: "Убрать",
  },
  prompts: {
    whyHard: "Что делает это сложным?",
    tried: "Что вы уже пробовали?",
    couldDo: "Что вы могли бы с этим сделать?",
    solved: "Как это будет выглядеть, когда будет решено?",
    doNothing: "Что случится, если ничего не делать?",
    unknowns: "Чего вы ещё не знаете?",
    options: "Какие у вас есть варианты?",
    matters: "Что для вас здесь важнее всего?",
    bestCase: "Что лучшее может произойти?",
    worries: "Что вас беспокоит?",
    leaning: "К чему вы склоняетесь и почему?",
    howKnow: "Как вы поймёте, что достигли цели?",
    firstStep: "Какой маленький шаг вы можете сделать?",
    inTheWay: "Что может помешать?",
    helps: "Что бы вам помогло?",
    ifNot: "А если не получится?",
    wentWell: "Что получилось?",
    wentBad: "Что не получилось?",
    whyHappened: "Почему всё вышло именно так?",
    nextTime: "Что попробуете в следующий раз?",
    anythingElse: "Что-то ещё на уме?",
  },
  shape: {
    title: "Упорядочьте мысли",
    hint: "Проверьте, чем является каждая мысль и от чего она отходит. Большинство уже на месте — поправьте только то, что не так.",
    hangsFrom: "Отходит от",
    center: "Ваша главная мысль",
    remove: "Убрать",
    add: "+ Добавить мысль",
    newThought: "Новая мысль",
    empty: "Мыслей пока нет — вернитесь и напишите несколько или добавьте здесь.",
  },
  build: {
    title: "Превратите это в карту",
    hint: "Дайте ей название и решите, для кого она. На карте можно добавлять дальше.",
    name: "Название карты",
    personal: { label: "Только для меня", hint: "Личное пространство для размышлений. Пригласить людей можно и позже." },
    discussion: { label: "Для обсуждения", hint: "Пригласите других оспаривать и дополнять ваши мысли." },
    summary: (n) => `Ваша главная мысль и ${n} ${ruThoughts(n)} вокруг неё`,
    submit: "Создать карту",
    building: (done, total) => `Размещаю ${done} из ${total}…`,
    error: "Не удалось создать карту. Ваши мысли сохранены — попробуйте ещё раз.",
  },
  preview: "Ваша карта сейчас",
  centerFirst: "Сначала напишите главную мысль.",
};

export const THINK_STRINGS: Record<Language, ThinkStrings> = { en, cs, uk, ru };
