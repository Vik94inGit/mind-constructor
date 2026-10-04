// Core-chrome translations — the screens/controls you touch just to get
// around and use the app (auth, dashboard, navbar, the map screen's own
// toolbar/tab labels). The deeper copy — node panel tabs, menus, modals, and
// error messages — lives in uiStrings.ts (reached as `t.ui`). Node type
// names themselves (Problem, Option, …) stay English on purpose: they are
// stored values, not labels. Interpolated strings are plain
// functions (not a runtime "{{token}}" template parser) so every language
// is checked against the exact same shape by TypeScript itself — a missing
// or mistyped key is a compile error, not a silent fallback to English at
// runtime.
import { UI_STRINGS } from "./uiStrings";
import type { UiStrings } from "./uiStrings";

export interface Translation {
  nav: {
    maps: string;
    admin: string;
    logout: string;
  };
  auth: {
    login: {
      title: string;
      subtitle: string;
      email: string;
      password: string;
      submit: string;
      submitting: string;
      or: string;
      noAccount: string;
      registerLink: string;
      genericError: string;
      tryDemo: string;
      tryDemoBusy: string;
      demoUnavailable: string;
    };
    register: {
      title: string;
      subtitle: string;
      username: string;
      email: string;
      password: string;
      passwordHint: string;
      submit: string;
      submitting: string;
      or: string;
      haveAccount: string;
      loginLink: string;
      genericError: string;
    };
  };
  dashboard: {
    title: string;
    subtitle: string;
    newMap: string;
    filter: { all: string; owned: string; shared: string };
    loading: string;
    empty: string;
    emptyOwnedHint: string;
    loadError: string;
    card: {
      members: (count: number) => string;
      nodes: (count: number) => string;
      maps: (count: number) => string;
      owner: string;
    };
    menu: { summary: string; edit: string; invite: string; delete: string; moveToFolder: string };
    library: {
      newFolder: string;
      search: string;
      noResults: (query: string) => string;
      allMaps: string;
      folderEmpty: string;
      prev: string;
      next: string;
      page: (page: number, total: number) => string;
      foldersError: string;
      deleteMapError: string;
      folderMenu: { open: string; rename: string; delete: string };
      deleteFolderConfirm: (name: string) => string;
      folderModal: {
        createTitle: string;
        renameTitle: string;
        name: string;
        cancel: string;
        create: string;
        save: string;
        error: string;
      };
      moveModal: { title: (name: string) => string; noFolder: string; error: string };
    };
    deleteConfirm: (name: string) => string;
    createModal: {
      title: string;
      name: string;
      ownerColor: string;
      boardColor: string;
      startingPoint: string;
      templates: {
        problem: { label: string; desc: string };
        decision: { label: string; desc: string };
        goal: { label: string; desc: string };
        retro: { label: string; desc: string };
      };
      mode: {
        label: string;
        discussion: { label: string; desc: string };
        personal: { label: string; desc: string };
      };
      cancel: string;
      submit: string;
      submitting: string;
      error: string;
    };
    editModal: {
      title: (name: string) => string;
      name: string;
      boardColor: string;
      cancel: string;
      submit: string;
      submitting: string;
      error: string;
    };
  };
  map: {
    toolbar: {
      back: string;
      add: string;
      moveOn: string;
      moveOff: string;
      discussionTooltip: string;
      personalTooltip: string;
      presentation: string;
      zoomOut: string;
      zoomReset: string;
      zoomIn: string;
      expandToolbar: string;
      readingMode: string;
      readingPuzzle: string;
      readingMixed: string;
      readingIconText: string;
      readingActual: string;
    };
    addMenu: {
      invite: string;
      createNode: string;
      createCircle: string;
      exportText: string;
      deleteMap: string;
    };
    panelTabs: {
      info: string;
      modify: string;
      attack: string;
      protect: string;
      history: string;
      packed: (count: number) => string;
    };
    legend: { positiveCircle: string; negativeCircle: string };
  };
  /** "Text → map" (pages/SplitTextPage.tsx). */
  split: {
    entry: string;
    title: string;
    hint: string;
    name: string;
    namePlaceholder: string;
    text: string;
    textPlaceholder: string;
    rootType: string;
    next: string;
    back: string;
    markTitle: string;
    markHint: string;
    mainNode: string;
    selected: string;
    clearSelection: string;
    overlap: string;
    pieces: (count: number) => string;
    noPieces: string;
    remove: string;
    create: string;
    creating: (done: number, total: number) => string;
    error: string;
    startOver: string;
    startOverConfirm: string;
  };
  theme: { toggleToLight: string; toggleToDark: string };
  language: { label: string };
  ui: UiStrings;
}

export const LANGUAGES = ["en", "cs", "uk", "ru"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  cs: "Čeština",
  uk: "Українська",
  ru: "Русский",
};

const en: Translation = {
  nav: { maps: "Maps", admin: "Admin", logout: "Log out" },
  auth: {
    login: {
      title: "Welcome back",
      subtitle: "Log in to your Mind Constructor maps.",
      email: "Email",
      password: "Password",
      submit: "Log in",
      submitting: "Logging in…",
      or: "or",
      noAccount: "No account?",
      registerLink: "Register",
      genericError: "Something went wrong",
      tryDemo: "Try it without an account",
      tryDemoBusy: "Setting up your demo…",
      demoUnavailable: "The demo isn't available on this server yet — its backend is out of date. Update or restart the backend and try again.",
    },
    register: {
      title: "Create your account",
      subtitle: "Start mapping out your next decision.",
      username: "Username",
      email: "Email",
      password: "Password",
      passwordHint: "At least 6 characters",
      submit: "Register",
      submitting: "Creating account…",
      or: "or",
      haveAccount: "Already have an account?",
      loginLink: "Log in",
      genericError: "Something went wrong",
    },
  },
  dashboard: {
    title: "Your maps",
    subtitle: "Boards you own or were invited to.",
    newMap: "+ New map",
    filter: { all: "All", owned: "Owned", shared: "Shared" },
    loading: "Loading maps…",
    empty: "No maps here yet.",
    emptyOwnedHint: "Create one to get started.",
    loadError: "Failed to load maps",
    card: {
      members: (count) => `${count} member(s)`,
      nodes: (count) => `${count} node(s)`,
      maps: (count) => `${count} map(s)`,
      owner: "Owner",
    },
    menu: { summary: "Summary", edit: "Edit", invite: "Invite", delete: "Delete", moveToFolder: "Move to folder…" },
    library: {
      newFolder: "+ New folder",
      search: "Search maps and folders…",
      noResults: (query) => `Nothing matches "${query}".`,
      allMaps: "All maps",
      folderEmpty: "This folder is empty. Move maps here from their ⋯ menu.",
      prev: "‹ Prev",
      next: "Next ›",
      page: (page, total) => `Page ${page} of ${total}`,
      foldersError: "Failed to load folders",
      deleteMapError: "Couldn't delete the map",
      folderMenu: { open: "Open", rename: "Rename", delete: "Delete" },
      deleteFolderConfirm: (name) => `Delete folder "${name}"? The maps in it stay — they go back to All maps.`,
      folderModal: {
        createTitle: "New folder",
        renameTitle: "Rename folder",
        name: "Name",
        cancel: "Cancel",
        create: "Create",
        save: "Save",
        error: "Couldn't save the folder",
      },
      moveModal: { title: (name) => `Move "${name}" to…`, noFolder: "No folder (All maps)", error: "Couldn't move the map" },
    },
    deleteConfirm: (name) => `Delete "${name}"? This removes every node on it too.`,
    createModal: {
      title: "New map",
      name: "Name",
      ownerColor: "Your color on this map",
      boardColor: "Board color",
      startingPoint: "Starting point",
      templates: {
        problem: { label: "Problem analysis", desc: "Break a problem into parts, weigh ways to solve it, plan and check the result." },
        decision: { label: "Decision", desc: "Compare options with their advantages and risks." },
        goal: { label: "Goal planning", desc: "A goal with success criteria, steps, obstacles and a review." },
        retro: { label: "Retrospective", desc: "What went well, what did not, and what to change." },
      },
      mode: {
        label: "Mode",
        discussion: { label: "Discussion", desc: "Battle: attacks do damage, and the owner may attack with any type of node." },
        personal: { label: "Personal", desc: "Creating: attacks are decoration and do no damage. You can switch any time." },
      },
      cancel: "Cancel",
      submit: "Create map",
      submitting: "Creating…",
      error: "Failed to create map",
    },
    editModal: {
      title: (name) => `Edit "${name}"`,
      name: "Name",
      boardColor: "Board color",
      cancel: "Cancel",
      submit: "Save changes",
      submitting: "Saving…",
      error: "Failed to update map",
    },
  },
  map: {
    toolbar: {
      back: "Back to maps",
      add: "Add",
      moveOn: "Move nodes: on — tap Done to go back to just selecting",
      moveOff: "Move nodes: off — turn on to drag nodes around",
      discussionTooltip:
        "Battle mode: on — attacks do damage, and members other than the owner are limited in what they can attack with. Click to switch to Creating mode.",
      personalTooltip:
        "Creating mode: on — attacks are decoration only and do no damage; no shields. Click to switch back to Battle mode.",
      presentation: "Present — step through the map as slides",
      zoomOut: "Zoom out",
      zoomReset: "Reset zoom",
      zoomIn: "Zoom in",
      expandToolbar: "Show toolbar",
      readingMode: "Reading mode",
      readingPuzzle: "Puzzle cards",
      readingMixed: "Mixed: zone cards + icons",
      readingIconText: "Icons + text",
      readingActual: "Actual",
    },
    addMenu: {
      invite: "Invite user",
      createNode: "Create new node",
      createCircle: "Create circle",
      exportText: "Export text",
      deleteMap: "Delete map",
    },
    panelTabs: {
      info: "Info",
      modify: "Modify",
      attack: "Attack",
      protect: "Protect",
      history: "History",
      packed: (count) => `Packed (${count})`,
    },
    legend: { positiveCircle: "positive circle", negativeCircle: "negative circle / under fire" },
  },
  split: {
    entry: "✂ Text → map",
    title: "Turn a text into a map",
    hint: "Paste or write the whole text. It becomes the main node; then you pick out its pieces and say what each one is.",
    name: "Map name",
    namePlaceholder: "Taken from the text if left empty",
    text: "Text",
    textPlaceholder: "Paste your text here…",
    rootType: "Main node type",
    next: "Next: mark pieces →",
    back: "← Back",
    markTitle: "Mark the pieces",
    markHint: "Select part of the text with the cursor (or hold and drag on a phone), then choose what it is. Each piece becomes a node under the main one.",
    mainNode: "Main node — the whole text",
    selected: "Selected",
    clearSelection: "Clear selection",
    overlap: "That overlaps a piece you already marked — remove it first or select something else.",
    pieces: (count) => `Pieces (${count})`,
    noPieces: "No pieces yet — select some text above.",
    remove: "Remove",
    create: "Create map",
    creating: (done, total) => `Creating… ${done} of ${total}`,
    error: "Couldn't create the map",
    startOver: "Start over",
    startOverConfirm: "Clear this text and all its pieces?",
  },
  theme: { toggleToLight: "Switch to light mode", toggleToDark: "Switch to dark mode" },
  language: { label: "Language" },
  ui: UI_STRINGS.en,
};

const cs: Translation = {
  nav: { maps: "Mapy", admin: "Administrace", logout: "Odhlásit se" },
  auth: {
    login: {
      title: "Vítejte zpět",
      subtitle: "Přihlaste se ke svým mapám v Mind Constructor.",
      email: "E-mail",
      password: "Heslo",
      submit: "Přihlásit se",
      submitting: "Přihlašování…",
      or: "nebo",
      noAccount: "Nemáte účet?",
      registerLink: "Registrovat se",
      genericError: "Něco se pokazilo",
      tryDemo: "Vyzkoušet bez účtu",
      tryDemoBusy: "Připravujeme vaše demo…",
      demoUnavailable: "Demo na tomto serveru zatím není k dispozici — jeho backend je zastaralý. Aktualizujte nebo restartujte backend a zkuste to znovu.",
    },
    register: {
      title: "Vytvořte si účet",
      subtitle: "Začněte mapovat své další rozhodnutí.",
      username: "Uživatelské jméno",
      email: "E-mail",
      password: "Heslo",
      passwordHint: "Alespoň 6 znaků",
      submit: "Registrovat se",
      submitting: "Vytváření účtu…",
      or: "nebo",
      haveAccount: "Už máte účet?",
      loginLink: "Přihlásit se",
      genericError: "Něco se pokazilo",
    },
  },
  dashboard: {
    title: "Vaše mapy",
    subtitle: "Nástěnky, které vlastníte nebo do kterých jste byli pozváni.",
    newMap: "+ Nová mapa",
    filter: { all: "Vše", owned: "Vlastní", shared: "Sdílené" },
    loading: "Načítání map…",
    empty: "Zatím žádné mapy.",
    emptyOwnedHint: "Vytvořte první a začněte.",
    loadError: "Nepodařilo se načíst mapy",
    card: {
      members: (count) => `${count} člen(ů)`,
      nodes: (count) => `${count} uzel(ů)`,
      maps: (count) => `Map: ${count}`,
      owner: "Vlastník",
    },
    menu: { summary: "Přehled", edit: "Upravit", invite: "Pozvat", delete: "Smazat", moveToFolder: "Přesunout do složky…" },
    library: {
      newFolder: "+ Nová složka",
      search: "Hledat mapy a složky…",
      noResults: (query) => `Nic neodpovídá „${query}“.`,
      allMaps: "Všechny mapy",
      folderEmpty: "Složka je prázdná. Mapy sem přesunete z jejich nabídky ⋯.",
      prev: "‹ Předchozí",
      next: "Další ›",
      page: (page, total) => `Strana ${page} z ${total}`,
      foldersError: "Nepodařilo se načíst složky",
      deleteMapError: "Mapu se nepodařilo smazat",
      folderMenu: { open: "Otevřít", rename: "Přejmenovat", delete: "Smazat" },
      deleteFolderConfirm: (name) => `Smazat složku „${name}“? Mapy v ní zůstanou — vrátí se do Všech map.`,
      folderModal: {
        createTitle: "Nová složka",
        renameTitle: "Přejmenovat složku",
        name: "Název",
        cancel: "Zrušit",
        create: "Vytvořit",
        save: "Uložit",
        error: "Složku se nepodařilo uložit",
      },
      moveModal: { title: (name) => `Přesunout „${name}“ do…`, noFolder: "Bez složky (Všechny mapy)", error: "Mapu se nepodařilo přesunout" },
    },
    deleteConfirm: (name) => `Smazat „${name}“? Tím se odstraní i všechny uzly na ní.`,
    createModal: {
      title: "Nová mapa",
      name: "Název",
      ownerColor: "Vaše barva na této mapě",
      boardColor: "Barva nástěnky",
      startingPoint: "Výchozí bod",
      templates: {
        problem: { label: "Analýza problému", desc: "Rozložte problém na části, zvažte řešení, naplánujte a ověřte výsledek." },
        decision: { label: "Rozhodnutí", desc: "Porovnejte varianty s jejich výhodami a riziky." },
        goal: { label: "Plánování cíle", desc: "Cíl s kritérii úspěchu, kroky, překážkami a kontrolou." },
        retro: { label: "Retrospektiva", desc: "Co se povedlo, co ne a co změnit." },
      },
      mode: {
        label: "Režim",
        discussion: { label: "Diskuze", desc: "Bojový režim: útoky způsobují poškození a vlastník může útočit jakýmkoli typem uzlu." },
        personal: { label: "Osobní", desc: "Tvůrčí režim: útoky jsou jen dekorace bez poškození. Kdykoli lze přepnout." },
      },
      cancel: "Zrušit",
      submit: "Vytvořit mapu",
      submitting: "Vytváření…",
      error: "Nepodařilo se vytvořit mapu",
    },
    editModal: {
      title: (name) => `Upravit „${name}“`,
      name: "Název",
      boardColor: "Barva nástěnky",
      cancel: "Zrušit",
      submit: "Uložit změny",
      submitting: "Ukládání…",
      error: "Nepodařilo se aktualizovat mapu",
    },
  },
  map: {
    toolbar: {
      back: "Zpět na mapy",
      add: "Přidat",
      moveOn: "Přesouvání uzlů: zapnuto — klepnutím na Hotovo se vrátíte jen k výběru",
      moveOff: "Přesouvání uzlů: vypnuto — zapněte pro přetahování uzlů",
      discussionTooltip:
        "Bojový režim: zapnuto — útoky způsobují poškození a členové kromě vlastníka jsou omezeni v tom, čím mohou útočit. Klepnutím přepnete do tvůrčího režimu.",
      personalTooltip:
        "Tvůrčí režim: zapnuto — útoky jsou jen dekorace a nezpůsobují poškození; bez štítů. Klepnutím přepnete zpět do bojového režimu.",
      presentation: "Prezentovat — projít mapu jako snímky",
      zoomOut: "Oddálit",
      zoomReset: "Obnovit přiblížení",
      zoomIn: "Přiblížit",
      expandToolbar: "Zobrazit panel nástrojů",
      readingMode: "Režim čtení",
      readingPuzzle: "Karty puzzle",
      readingMixed: "Smíšený: karty zón + ikony",
      readingIconText: "Ikony + text",
      readingActual: "Aktuální",
    },
    addMenu: {
      invite: "Pozvat uživatele",
      createNode: "Vytvořit nový uzel",
      createCircle: "Vytvořit kruh",
      exportText: "Exportovat text",
      deleteMap: "Smazat mapu",
    },
    panelTabs: {
      info: "Info",
      modify: "Upravit",
      attack: "Útok",
      protect: "Ochrana",
      history: "Historie",
      packed: (count) => `Sbaleno (${count})`,
    },
    legend: { positiveCircle: "pozitivní kruh", negativeCircle: "negativní kruh / pod útokem" },
  },
  split: {
    entry: "✂ Text → mapa",
    title: "Udělejte z textu mapu",
    hint: "Vložte nebo napište celý text. Stane se hlavním uzlem; potom z něj vyberete části a určíte, co která je.",
    name: "Název mapy",
    namePlaceholder: "Když zůstane prázdný, vezme se z textu",
    text: "Text",
    textPlaceholder: "Sem vložte text…",
    rootType: "Typ hlavního uzlu",
    next: "Dál: označit části →",
    back: "← Zpět",
    markTitle: "Označte části",
    markHint: "Vyberte část textu kurzorem (na telefonu podržte a táhněte) a zvolte, co to je. Každá část bude uzlem pod hlavním.",
    mainNode: "Hlavní uzel — celý text",
    selected: "Vybráno",
    clearSelection: "Zrušit výběr",
    overlap: "To se překrývá s už označenou částí — nejdřív ji odeberte, nebo vyberte něco jiného.",
    pieces: (count) => `Části (${count})`,
    noPieces: "Zatím žádné části — vyberte nahoře kus textu.",
    remove: "Odebrat",
    create: "Vytvořit mapu",
    creating: (done, total) => `Vytvářím… ${done} z ${total}`,
    error: "Mapu se nepodařilo vytvořit",
    startOver: "Začít znovu",
    startOverConfirm: "Smazat tento text i všechny jeho části?",
  },
  theme: { toggleToLight: "Přepnout na světlý režim", toggleToDark: "Přepnout na tmavý režim" },
  language: { label: "Jazyk" },
  ui: UI_STRINGS.cs,
};

const uk: Translation = {
  nav: { maps: "Карти", admin: "Адміністрування", logout: "Вийти" },
  auth: {
    login: {
      title: "З поверненням",
      subtitle: "Увійдіть до своїх карт у Mind Constructor.",
      email: "Електронна пошта",
      password: "Пароль",
      submit: "Увійти",
      submitting: "Вхід…",
      or: "або",
      noAccount: "Немає облікового запису?",
      registerLink: "Зареєструватися",
      genericError: "Щось пішло не так",
      tryDemo: "Спробувати без реєстрації",
      tryDemoBusy: "Готуємо вашу демо-версію…",
      demoUnavailable: "Демо на цьому сервері ще недоступне — його бекенд застарів. Оновіть або перезапустіть бекенд і спробуйте ще раз.",
    },
    register: {
      title: "Створіть обліковий запис",
      subtitle: "Почніть картувати своє наступне рішення.",
      username: "Ім'я користувача",
      email: "Електронна пошта",
      password: "Пароль",
      passwordHint: "Щонайменше 6 символів",
      submit: "Зареєструватися",
      submitting: "Створення облікового запису…",
      or: "або",
      haveAccount: "Вже є обліковий запис?",
      loginLink: "Увійти",
      genericError: "Щось пішло не так",
    },
  },
  dashboard: {
    title: "Ваші карти",
    subtitle: "Дошки, якими ви володієте або до яких вас запросили.",
    newMap: "+ Нова карта",
    filter: { all: "Усі", owned: "Власні", shared: "Спільні" },
    loading: "Завантаження карт…",
    empty: "Тут поки немає карт.",
    emptyOwnedHint: "Створіть першу, щоб почати.",
    loadError: "Не вдалося завантажити карти",
    card: {
      members: (count) => `${count} учасник(ів)`,
      nodes: (count) => `${count} вузол(ів)`,
      maps: (count) => `Карт: ${count}`,
      owner: "Власник",
    },
    menu: { summary: "Підсумок", edit: "Редагувати", invite: "Запросити", delete: "Видалити", moveToFolder: "Перемістити в папку…" },
    library: {
      newFolder: "+ Нова папка",
      search: "Пошук карт і папок…",
      noResults: (query) => `Нічого не знайдено за «${query}».`,
      allMaps: "Усі карти",
      folderEmpty: "Папка порожня. Переміщуйте сюди карти через їхнє меню ⋯.",
      prev: "‹ Назад",
      next: "Далі ›",
      page: (page, total) => `Сторінка ${page} з ${total}`,
      foldersError: "Не вдалося завантажити папки",
      deleteMapError: "Не вдалося видалити карту",
      folderMenu: { open: "Відкрити", rename: "Перейменувати", delete: "Видалити" },
      deleteFolderConfirm: (name) => `Видалити папку «${name}»? Карти з неї залишаться — повернуться в Усі карти.`,
      folderModal: {
        createTitle: "Нова папка",
        renameTitle: "Перейменувати папку",
        name: "Назва",
        cancel: "Скасувати",
        create: "Створити",
        save: "Зберегти",
        error: "Не вдалося зберегти папку",
      },
      moveModal: { title: (name) => `Перемістити «${name}» до…`, noFolder: "Без папки (Усі карти)", error: "Не вдалося перемістити карту" },
    },
    deleteConfirm: (name) => `Видалити «${name}»? Це також видалить усі вузли на ній.`,
    createModal: {
      title: "Нова карта",
      name: "Назва",
      ownerColor: "Ваш колір на цій карті",
      boardColor: "Колір дошки",
      startingPoint: "Початкова точка",
      templates: {
        problem: { label: "Аналіз проблеми", desc: "Розбийте проблему на частини, зважте способи вирішення, сплануйте й перевірте результат." },
        decision: { label: "Рішення", desc: "Порівняйте варіанти з їхніми перевагами й ризиками." },
        goal: { label: "Планування цілі", desc: "Ціль із критеріями успіху, кроками, перешкодами та перевіркою." },
        retro: { label: "Ретроспектива", desc: "Що вдалося, що ні і що змінити." },
      },
      mode: {
        label: "Режим",
        discussion: { label: "Обговорення", desc: "Бойовий режим: атаки завдають шкоди, власник може атакувати будь-яким типом вузла." },
        personal: { label: "Особистий", desc: "Творчий режим: атаки лише декорація без шкоди. Перемкнути можна будь-коли." },
      },
      cancel: "Скасувати",
      submit: "Створити карту",
      submitting: "Створення…",
      error: "Не вдалося створити карту",
    },
    editModal: {
      title: (name) => `Редагувати «${name}»`,
      name: "Назва",
      boardColor: "Колір дошки",
      cancel: "Скасувати",
      submit: "Зберегти зміни",
      submitting: "Збереження…",
      error: "Не вдалося оновити карту",
    },
  },
  map: {
    toolbar: {
      back: "Назад до карт",
      add: "Додати",
      moveOn: "Переміщення вузлів: увімкнено — натисніть «Готово», щоб повернутися до вибору",
      moveOff: "Переміщення вузлів: вимкнено — увімкніть, щоб перетягувати вузли",
      discussionTooltip:
        "Бойовий режим: увімкнено — атаки завдають шкоди, а учасники, крім власника, обмежені в тому, чим можуть атакувати. Натисніть, щоб перейти в творчий режим.",
      personalTooltip:
        "Творчий режим: увімкнено — атаки лише декорація й не завдають шкоди; без щитів. Натисніть, щоб повернутися в бойовий режим.",
      presentation: "Презентація — пройти мапу як слайди",
      zoomOut: "Зменшити",
      zoomReset: "Скинути масштаб",
      zoomIn: "Збільшити",
      expandToolbar: "Показати панель інструментів",
      readingMode: "Режим читання",
      readingPuzzle: "Картки-пазли",
      readingMixed: "Змішаний: картки зон + іконки",
      readingIconText: "Іконки + текст",
      readingActual: "Поточний",
    },
    addMenu: {
      invite: "Запросити користувача",
      createNode: "Створити новий вузол",
      createCircle: "Створити коло",
      exportText: "Експортувати текст",
      deleteMap: "Видалити карту",
    },
    panelTabs: {
      info: "Інфо",
      modify: "Змінити",
      attack: "Атака",
      protect: "Захист",
      history: "Історія",
      packed: (count) => `Згорнуто (${count})`,
    },
    legend: { positiveCircle: "позитивне коло", negativeCircle: "негативне коло / під атакою" },
  },
  split: {
    entry: "✂ Текст → карта",
    title: "Зробіть із тексту карту",
    hint: "Вставте або напишіть увесь текст. Він стане головним вузлом; потім ви виділите його частини й вкажете, що кожна з них означає.",
    name: "Назва карти",
    namePlaceholder: "Якщо порожньо — візьметься з тексту",
    text: "Текст",
    textPlaceholder: "Вставте текст сюди…",
    rootType: "Тип головного вузла",
    next: "Далі: позначити частини →",
    back: "← Назад",
    markTitle: "Позначте частини",
    markHint: "Виділіть частину тексту курсором (на телефоні — затисніть і потягніть) і виберіть, що це. Кожна частина стане вузлом під головним.",
    mainNode: "Головний вузол — увесь текст",
    selected: "Виділено",
    clearSelection: "Скасувати виділення",
    overlap: "Це перетинається з уже позначеною частиною — спершу приберіть її або виділіть інше.",
    pieces: (count) => `Частини (${count})`,
    noPieces: "Частин поки немає — виділіть текст угорі.",
    remove: "Прибрати",
    create: "Створити карту",
    creating: (done, total) => `Створюю… ${done} з ${total}`,
    error: "Не вдалося створити карту",
    startOver: "Почати спочатку",
    startOverConfirm: "Очистити цей текст і всі його частини?",
  },
  theme: { toggleToLight: "Перемкнути на світлий режим", toggleToDark: "Перемкнути на темний режим" },
  language: { label: "Мова" },
  ui: UI_STRINGS.uk,
};

const ru: Translation = {
  nav: { maps: "Карты", admin: "Администрирование", logout: "Выйти" },
  auth: {
    login: {
      title: "С возвращением",
      subtitle: "Войдите в свои карты Mind Constructor.",
      email: "Электронная почта",
      password: "Пароль",
      submit: "Войти",
      submitting: "Вход…",
      or: "или",
      noAccount: "Нет аккаунта?",
      registerLink: "Зарегистрироваться",
      genericError: "Что-то пошло не так",
      tryDemo: "Попробовать без регистрации",
      tryDemoBusy: "Готовим ваше демо…",
      demoUnavailable: "Демо на этом сервере пока недоступно — его бэкенд устарел. Обновите или перезапустите бэкенд и попробуйте снова.",
    },
    register: {
      title: "Создайте аккаунт",
      subtitle: "Начните картировать своё следующее решение.",
      username: "Имя пользователя",
      email: "Электронная почта",
      password: "Пароль",
      passwordHint: "Не менее 6 символов",
      submit: "Зарегистрироваться",
      submitting: "Создание аккаунта…",
      or: "или",
      haveAccount: "Уже есть аккаунт?",
      loginLink: "Войти",
      genericError: "Что-то пошло не так",
    },
  },
  dashboard: {
    title: "Ваши карты",
    subtitle: "Доски, которыми вы владеете или в которые приглашены.",
    newMap: "+ Новая карта",
    filter: { all: "Все", owned: "Свои", shared: "Общие" },
    loading: "Загрузка карт…",
    empty: "Здесь пока нет карт.",
    emptyOwnedHint: "Создайте первую, чтобы начать.",
    loadError: "Не удалось загрузить карты",
    card: {
      members: (count) => `${count} участник(ов)`,
      nodes: (count) => `${count} узел(узлов)`,
      maps: (count) => `Карт: ${count}`,
      owner: "Владелец",
    },
    menu: { summary: "Сводка", edit: "Изменить", invite: "Пригласить", delete: "Удалить", moveToFolder: "Переместить в папку…" },
    library: {
      newFolder: "+ Новая папка",
      search: "Поиск карт и папок…",
      noResults: (query) => `Ничего не найдено по «${query}».`,
      allMaps: "Все карты",
      folderEmpty: "Папка пуста. Перемещайте сюда карты через их меню ⋯.",
      prev: "‹ Назад",
      next: "Далее ›",
      page: (page, total) => `Страница ${page} из ${total}`,
      foldersError: "Не удалось загрузить папки",
      deleteMapError: "Не удалось удалить карту",
      folderMenu: { open: "Открыть", rename: "Переименовать", delete: "Удалить" },
      deleteFolderConfirm: (name) => `Удалить папку «${name}»? Карты из неё останутся — вернутся во Все карты.`,
      folderModal: {
        createTitle: "Новая папка",
        renameTitle: "Переименовать папку",
        name: "Название",
        cancel: "Отмена",
        create: "Создать",
        save: "Сохранить",
        error: "Не удалось сохранить папку",
      },
      moveModal: { title: (name) => `Переместить «${name}» в…`, noFolder: "Без папки (Все карты)", error: "Не удалось переместить карту" },
    },
    deleteConfirm: (name) => `Удалить «${name}»? Это также удалит все узлы на ней.`,
    createModal: {
      title: "Новая карта",
      name: "Название",
      ownerColor: "Ваш цвет на этой карте",
      boardColor: "Цвет доски",
      startingPoint: "Отправная точка",
      templates: {
        problem: { label: "Анализ проблемы", desc: "Разбейте проблему на части, взвесьте способы решения, спланируйте и проверьте результат." },
        decision: { label: "Решение", desc: "Сравните варианты с их преимуществами и рисками." },
        goal: { label: "Планирование цели", desc: "Цель с критериями успеха, шагами, препятствиями и проверкой." },
        retro: { label: "Ретроспектива", desc: "Что получилось, что нет и что изменить." },
      },
      mode: {
        label: "Режим",
        discussion: { label: "Обсуждение", desc: "Боевой режим: атаки наносят урон, владелец может атаковать любым типом узла." },
        personal: { label: "Личный", desc: "Творческий режим: атаки лишь декорация без урона. Переключить можно в любой момент." },
      },
      cancel: "Отмена",
      submit: "Создать карту",
      submitting: "Создание…",
      error: "Не удалось создать карту",
    },
    editModal: {
      title: (name) => `Изменить «${name}»`,
      name: "Название",
      boardColor: "Цвет доски",
      cancel: "Отмена",
      submit: "Сохранить изменения",
      submitting: "Сохранение…",
      error: "Не удалось обновить карту",
    },
  },
  map: {
    toolbar: {
      back: "Назад к картам",
      add: "Добавить",
      moveOn: "Перемещение узлов: включено — нажмите «Готово», чтобы вернуться к выбору",
      moveOff: "Перемещение узлов: выключено — включите, чтобы перетаскивать узлы",
      discussionTooltip:
        "Боевой режим: включён — атаки наносят урон, а участники, кроме владельца, ограничены в том, чем могут атаковать. Нажмите, чтобы переключиться в творческий режим.",
      personalTooltip:
        "Творческий режим: включён — атаки лишь декорация и не наносят урона; без щитов. Нажмите, чтобы вернуться в боевой режим.",
      presentation: "Презентация — пройти карту как слайды",
      zoomOut: "Уменьшить",
      zoomReset: "Сбросить масштаб",
      zoomIn: "Увеличить",
      expandToolbar: "Показать панель инструментов",
      readingMode: "Режим чтения",
      readingPuzzle: "Карточки-пазлы",
      readingMixed: "Смешанный: карточки зон + иконки",
      readingIconText: "Иконки + текст",
      readingActual: "Текущий",
    },
    addMenu: {
      invite: "Пригласить пользователя",
      createNode: "Создать новый узел",
      createCircle: "Создать круг",
      exportText: "Экспортировать текст",
      deleteMap: "Удалить карту",
    },
    panelTabs: {
      info: "Инфо",
      modify: "Изменить",
      attack: "Атака",
      protect: "Защита",
      history: "История",
      packed: (count) => `Свёрнуто (${count})`,
    },
    legend: { positiveCircle: "положительный круг", negativeCircle: "отрицательный круг / под атакой" },
  },
  split: {
    entry: "✂ Текст → карта",
    title: "Превратите текст в карту",
    hint: "Вставьте или напишите весь текст. Он станет главным узлом; затем вы выделите его части и укажете, что каждая из них значит.",
    name: "Название карты",
    namePlaceholder: "Если пусто — возьмётся из текста",
    text: "Текст",
    textPlaceholder: "Вставьте текст сюда…",
    rootType: "Тип главного узла",
    next: "Далее: отметить части →",
    back: "← Назад",
    markTitle: "Отметьте части",
    markHint: "Выделите часть текста курсором (на телефоне — зажмите и потяните) и выберите, что это. Каждая часть станет узлом под главным.",
    mainNode: "Главный узел — весь текст",
    selected: "Выделено",
    clearSelection: "Снять выделение",
    overlap: "Это пересекается с уже отмеченной частью — сначала уберите её или выделите другое.",
    pieces: (count) => `Части (${count})`,
    noPieces: "Частей пока нет — выделите текст выше.",
    remove: "Убрать",
    create: "Создать карту",
    creating: (done, total) => `Создаю… ${done} из ${total}`,
    error: "Не удалось создать карту",
    startOver: "Начать заново",
    startOverConfirm: "Очистить этот текст и все его части?",
  },
  theme: { toggleToLight: "Переключить на светлую тему", toggleToDark: "Переключить на тёмную тему" },
  language: { label: "Язык" },
  ui: UI_STRINGS.ru,
};

export const TRANSLATIONS: Record<Language, Translation> = { en, cs, uk, ru };
