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

const cs: SiegeStrings = {
  open: "Tah soupeře — napodobený soupeř zaútočí na jeden z vašich hradů",
  title: "Tah soupeře",
  intro: "Vaše zóny jsou hrady a ta vnější, která obklopuje ostatní, je království. Vyberte, kdo útočí, na který hrad a jak.",
  attacker: "Kdo útočí",
  invader: "Nájezdník zvenčí",
  target: "Který hrad",
  kingdom: "Království",
  castle: "Hrad",
  strategies: {
    siege: { name: "Obléhání", hint: "Otázka na vnější uzel, který byl zatím zpochybněn nejméně" },
    undermine: { name: "Podkopání", hint: "Zpochybní předpoklad pod hlavní věží" },
    assault: { name: "Útok na průlom", hint: "Fatální chyba na nejslabší nechráněný uzel" },
    sally: { name: "Výpad", hint: "Vrátí úder poslednímu útoku na vlastní hrad" },
    fortify: { name: "Opevnění", hint: "Místo útoku chrání vlastní hlavní věž" },
  },
  needsCastle: "Potřebuje útočící hrad",
  go: "Provést tah",
  nothing: "S touto strategií tu není co dělat — zkuste jinou.",
  failed: "Tah soupeře se nepovedl",
  done: (strategy, target) => `${strategy}: „${target}“. Jste na tahu.`,
  strikeBack: "⚔ Oplatit útok",
  strikeBackIntro: (name, heal) =>
    `Tento útok zasáhl váš uzel „${name}“. Odpovězte vlastním: každý zásah do něj vyléčí „${name}“ o ${heal}.`,
  noHolds: "Zatím žádné hrady: uzel se dvěma a více uzly pod sebou tvoří zónu a každá zóna je hrad.",
  moves: {
    siege: (name) => `Jak víte, že „${name}“ platí?`,
    undermine: (name) => `Co když důvod za „${name}“ vůbec neplatí?`,
    assault: (name) => `„${name}“ je místo, kde se celý plán láme.`,
    sally: (name) => `Tato námitka neobstojí: „${name}“`,
    fortify: (name) => `Držíme „${name}“.`,
  },
  finish: {
    button: "Ukončit diskusi",
    confirm: "Ukončit tuto diskusi? Nové body se uzavřou, dokud ji znovu neotevřete.",
    notYet: "Poslední slovo bylo vaše. Nechte nejdřív odpovědět protivníka, nebo ukončete, až budou všichni souhlasit.",
    waiting: (names) => `Ještě se čeká na: ${names}`,
    agree: "Souhlasit s ukončením diskuse",
    agreed: "Souhlasili jste s ukončením. Dalším stiskem souhlas vezmete zpět.",
    agreedCount: (agreed, total) => `S ukončením souhlasí ${agreed} z ${total}`,
    finished: (standing, fallen) => `Diskuse je ukončena: ${standing} obstálo, ${fallen} padlo.`,
    closed: "Nové body jsou uzavřené, dokud ji vlastník znovu neotevře.",
    replay: "Přehrát záznam",
    reopen: "Znovu otevřít",
    opponentMove: "Tah protivníka",
  },
  history: {
    open: "Historie — každá změna v této diskusi",
    title: "Historie",
    intro: "Každá úprava a smazání v této diskusi tu zůstává pro všechny. Nic z ní nejde odstranit.",
    empty: "Zatím žádné změny.",
    loading: "Načítání…",
    failed: "Historii se nepodařilo načíst.",
    edited: "upravil(a)",
    deleted: "smazal(a)",
    typeChanged: (from, to) => `typ: ${from} → ${to}`,
    titleChanged: "název",
    show: "Ukázat na mapě",
  },
};

const uk: SiegeStrings = {
  open: "Хід суперника — імітований суперник атакує один із ваших замків",
  title: "Хід суперника",
  intro: "Ваші зони — це замки, а найзовнішня — королівство. Оберіть, хто атакує, який замок і як.",
  attacker: "Хто атакує",
  invader: "Загарбник ззовні",
  target: "Який замок",
  kingdom: "Королівство",
  castle: "Замок",
  strategies: {
    siege: { name: "Облога", hint: "Питання до зовнішнього вузла, якого питали найменше" },
    undermine: { name: "Підкоп", hint: "Ставить під сумнів припущення під донжоном" },
    assault: { name: "Штурм пролому", hint: "Фатальна вада найслабшого незахищеного вузла" },
    sally: { name: "Вилазка", hint: "Відповідає на останню атаку на власний замок" },
    fortify: { name: "Укріплення", hint: "Замість атаки захищає власний донжон" },
  },
  needsCastle: "Потрібен замок, що атакує",
  go: "Зробити хід",
  nothing: "Із цією стратегією тут нічого робити — спробуйте іншу.",
  failed: "Хід суперника не вдався",
  done: (strategy, target) => `${strategy}: «${target}». Ваш хід.`,
  strikeBack: "⚔ Відповісти ударом",
  strikeBackIntro: (name, heal) =>
    `Ця атака влучила у ваш вузол «${name}». Відповідайте власною: кожен удар по ній лікує «${name}» на ${heal}.`,
  noHolds: "Замків ще немає: вузол із двома й більше вузлами під ним утворює зону, і кожна зона — замок.",
  moves: {
    siege: (name) => `Звідки ви знаєте, що «${name}» — правда?`,
    undermine: (name) => `А якщо причина за «${name}» зовсім не правдива?`,
    assault: (name) => `«${name}» — саме тут увесь план ламається.`,
    sally: (name) => `Це заперечення не тримається: «${name}»`,
    fortify: (name) => `Ми тримаємо «${name}».`,
  },
  finish: {
    button: "Завершити дискусію",
    confirm: "Завершити цю дискусію? Нові пункти буде закрито, доки ви її не відкриєте знову.",
    notYet: "Останнє слово було вашим. Дайте опоненту відповісти, або завершіть, коли всі погодяться.",
    waiting: (names) => `Ще чекаємо на: ${names}`,
    agree: "Погодитися завершити дискусію",
    agreed: "Ви погодилися завершити. Натисніть ще раз, щоб відкликати згоду.",
    agreedCount: (agreed, total) => `${agreed} з ${total} погодилися завершити`,
    finished: (standing, fallen) => `Дискусію завершено: вистояло ${standing}, впало ${fallen}.`,
    closed: "Нові пункти закрито, доки власник не відкриє дискусію знову.",
    replay: "Переглянути запис",
    reopen: "Відкрити знову",
    opponentMove: "Хід опонента",
  },
  history: {
    open: "Історія — кожна зміна в цій дискусії",
    title: "Історія",
    intro: "Кожна правка й видалення в цій дискусії лишаються тут для всіх. Звідси нічого не можна прибрати.",
    empty: "Змін ще немає.",
    loading: "Завантаження…",
    failed: "Не вдалося завантажити історію.",
    edited: "змінив(-ла)",
    deleted: "видалив(-ла)",
    typeChanged: (from, to) => `тип: ${from} → ${to}`,
    titleChanged: "назва",
    show: "Показати на мапі",
  },
};

const ru: SiegeStrings = {
  open: "Ход соперника — имитированный соперник атакует один из ваших замков",
  title: "Ход соперника",
  intro: "Ваши зоны — это замки, а самая внешняя — королевство. Выберите, кто атакует, какой замок и как.",
  attacker: "Кто атакует",
  invader: "Захватчик извне",
  target: "Какой замок",
  kingdom: "Королевство",
  castle: "Замок",
  strategies: {
    siege: { name: "Осада", hint: "Вопрос к внешнему узлу, который спрашивали меньше всего" },
    undermine: { name: "Подкоп", hint: "Ставит под сомнение допущение под донжоном" },
    assault: { name: "Штурм пролома", hint: "Фатальный изъян самого слабого незащищённого узла" },
    sally: { name: "Вылазка", hint: "Отвечает на последнюю атаку на собственный замок" },
    fortify: { name: "Укрепление", hint: "Вместо атаки защищает собственный донжон" },
  },
  needsCastle: "Нужен атакующий замок",
  go: "Сделать ход",
  nothing: "С этой стратегией здесь нечего делать — попробуйте другую.",
  failed: "Ход соперника не удался",
  done: (strategy, target) => `${strategy}: «${target}». Ваш ход.`,
  strikeBack: "⚔ Ответить ударом",
  strikeBackIntro: (name, heal) =>
    `Эта атака попала в ваш узел «${name}». Ответьте своей: каждый удар по ней лечит «${name}» на ${heal}.`,
  noHolds: "Замков пока нет: узел с двумя и более узлами под ним образует зону, и каждая зона — замок.",
  moves: {
    siege: (name) => `Откуда вы знаете, что «${name}» — правда?`,
    undermine: (name) => `А что если причина за «${name}» вовсе не верна?`,
    assault: (name) => `«${name}» — именно здесь весь план ломается.`,
    sally: (name) => `Это возражение не держится: «${name}»`,
    fortify: (name) => `Мы держим «${name}».`,
  },
  finish: {
    button: "Завершить дискуссию",
    confirm: "Завершить эту дискуссию? Новые пункты будут закрыты, пока вы её не откроете снова.",
    notYet: "Последнее слово было вашим. Дайте оппоненту ответить или завершите, когда все согласятся.",
    waiting: (names) => `Ещё ждём: ${names}`,
    agree: "Согласиться завершить дискуссию",
    agreed: "Вы согласились завершить. Нажмите ещё раз, чтобы отозвать согласие.",
    agreedCount: (agreed, total) => `${agreed} из ${total} согласились завершить`,
    finished: (standing, fallen) => `Дискуссия завершена: устояло ${standing}, пало ${fallen}.`,
    closed: "Новые пункты закрыты, пока владелец не откроет дискуссию снова.",
    replay: "Посмотреть запись",
    reopen: "Открыть снова",
    opponentMove: "Ход оппонента",
  },
  history: {
    open: "История — каждое изменение в этой дискуссии",
    title: "История",
    intro: "Каждая правка и удаление в этой дискуссии остаются здесь для всех. Отсюда ничего нельзя убрать.",
    empty: "Изменений пока нет.",
    loading: "Загрузка…",
    failed: "Не удалось загрузить историю.",
    edited: "изменил(а)",
    deleted: "удалил(а)",
    typeChanged: (from, to) => `тип: ${from} → ${to}`,
    titleChanged: "название",
    show: "Показать на карте",
  },
};

export const SIEGE_STRINGS: Record<Language, SiegeStrings> = { en, cs, uk, ru };
