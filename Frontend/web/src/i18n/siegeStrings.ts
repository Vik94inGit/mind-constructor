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
  noHolds: string;
  moves: Record<Strategy, (name: string) => string>;
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
  noHolds: "No castles yet: a node with two or more nodes under it makes a zone, and every zone is a castle.",
  moves: {
    siege: (name) => `How do you know that "${name}" is true?`,
    undermine: (name) => `What if the reason behind "${name}" isn't true at all?`,
    assault: (name) => `"${name}" is where the whole plan breaks.`,
    sally: (name) => `This objection doesn't hold: "${name}"`,
    fortify: (name) => `We hold "${name}".`,
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
  noHolds: "Zatím žádné hrady: uzel se dvěma a více uzly pod sebou tvoří zónu a každá zóna je hrad.",
  moves: {
    siege: (name) => `Jak víte, že „${name}“ platí?`,
    undermine: (name) => `Co když důvod za „${name}“ vůbec neplatí?`,
    assault: (name) => `„${name}“ je místo, kde se celý plán láme.`,
    sally: (name) => `Tato námitka neobstojí: „${name}“`,
    fortify: (name) => `Držíme „${name}“.`,
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
  noHolds: "Замків ще немає: вузол із двома й більше вузлами під ним утворює зону, і кожна зона — замок.",
  moves: {
    siege: (name) => `Звідки ви знаєте, що «${name}» — правда?`,
    undermine: (name) => `А якщо причина за «${name}» зовсім не правдива?`,
    assault: (name) => `«${name}» — саме тут увесь план ламається.`,
    sally: (name) => `Це заперечення не тримається: «${name}»`,
    fortify: (name) => `Ми тримаємо «${name}».`,
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
  noHolds: "Замков пока нет: узел с двумя и более узлами под ним образует зону, и каждая зона — замок.",
  moves: {
    siege: (name) => `Откуда вы знаете, что «${name}» — правда?`,
    undermine: (name) => `А что если причина за «${name}» вовсе не верна?`,
    assault: (name) => `«${name}» — именно здесь весь план ломается.`,
    sally: (name) => `Это возражение не держится: «${name}»`,
    fortify: (name) => `Мы держим «${name}».`,
  },
};

export const SIEGE_STRINGS: Record<Language, SiegeStrings> = { en, cs, uk, ru };
