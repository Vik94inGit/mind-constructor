// Core-chrome translations — the screens/controls you touch just to get
// around and use the app (auth, dashboard, navbar, the map screen's own
// toolbar/panel/tab labels). Deliberately *not* every string in the app:
// MapPage's deep combat/help copy (Attack/Protect tab body text, node-type
// names themselves, etc.) stays English-only for now — see this file's own
// scope note in CLAUDE.md-adjacent history. Interpolated strings are plain
// functions (not a runtime "{{token}}" template parser) so every language
// is checked against the exact same shape by TypeScript itself — a missing
// or mistyped key is a compile error, not a silent fallback to English at
// runtime.
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
      owner: string;
    };
    menu: { summary: string; edit: string; invite: string; delete: string };
    deleteConfirm: (name: string) => string;
    createModal: {
      title: string;
      name: string;
      ownerColor: string;
      boardColor: string;
      startingPoint: string;
      templates: {
        blank: { label: string; desc: string };
        singleProblem: { label: string; desc: string };
        decisionTree: { label: string; desc: string };
        proCon: { label: string; desc: string };
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
      zoomOut: string;
      zoomReset: string;
      zoomIn: string;
      expandToolbar: string;
      readingMode: string;
      readingClassic: string;
      readingIconText: string;
      readingActual: string;
    };
    addMenu: {
      invite: string;
      createNode: string;
      createCircle: string;
      nodeTypes: string;
      exportText: string;
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
  theme: { toggleToLight: string; toggleToDark: string };
  language: { label: string };
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
      owner: "Owner",
    },
    menu: { summary: "Summary", edit: "Edit", invite: "Invite", delete: "Delete" },
    deleteConfirm: (name) => `Delete "${name}"? This removes every node on it too.`,
    createModal: {
      title: "New map",
      name: "Name",
      ownerColor: "Your color on this map",
      boardColor: "Board color",
      startingPoint: "Starting point",
      templates: {
        blank: { label: "Blank canvas", desc: "Start from nothing." },
        singleProblem: { label: "Single Problem", desc: "One root node to branch off." },
        decisionTree: { label: "Decision tree", desc: "A Problem with two Options already branched off it." },
        proCon: { label: "Pro / Con", desc: "A topic with one case-for and one case-against branch." },
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
        "Discussion mode: on — combat (attack/protect) is visible. Click to switch to Personal mode.",
      personalTooltip:
        "Personal mode: on — combat (attack/protect) is hidden for solo organizing. Click to switch back to Discussion mode.",
      zoomOut: "Zoom out",
      zoomReset: "Reset zoom",
      zoomIn: "Zoom in",
      expandToolbar: "Show toolbar",
      readingMode: "Reading mode",
      readingClassic: "Classical mind map",
      readingIconText: "Icons + text",
      readingActual: "Actual",
    },
    addMenu: {
      invite: "Invite user",
      createNode: "Create new node",
      createCircle: "Create circle",
      nodeTypes: "Node types",
      exportText: "Export text",
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
  theme: { toggleToLight: "Switch to light mode", toggleToDark: "Switch to dark mode" },
  language: { label: "Language" },
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
      owner: "Vlastník",
    },
    menu: { summary: "Přehled", edit: "Upravit", invite: "Pozvat", delete: "Smazat" },
    deleteConfirm: (name) => `Smazat „${name}“? Tím se odstraní i všechny uzly na ní.`,
    createModal: {
      title: "Nová mapa",
      name: "Název",
      ownerColor: "Vaše barva na této mapě",
      boardColor: "Barva nástěnky",
      startingPoint: "Výchozí bod",
      templates: {
        blank: { label: "Prázdné plátno", desc: "Začít od ničeho." },
        singleProblem: { label: "Jeden problém", desc: "Jeden kořenový uzel k rozvětvení." },
        decisionTree: { label: "Rozhodovací strom", desc: "Problém se dvěma již rozvětvenými možnostmi." },
        proCon: { label: "Pro / Proti", desc: "Téma s jednou větví pro a jednou proti." },
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
        "Diskuzní režim: zapnuto — souboj (útok/ochrana) je viditelný. Klepnutím přepnete do osobního režimu.",
      personalTooltip:
        "Osobní režim: zapnuto — souboj (útok/ochrana) je skrytý pro samostatnou organizaci. Klepnutím přepnete zpět do diskuzního režimu.",
      zoomOut: "Oddálit",
      zoomReset: "Obnovit přiblížení",
      zoomIn: "Přiblížit",
      expandToolbar: "Zobrazit panel nástrojů",
      readingMode: "Režim čtení",
      readingClassic: "Klasická myšlenková mapa",
      readingIconText: "Ikony + text",
      readingActual: "Aktuální",
    },
    addMenu: {
      invite: "Pozvat uživatele",
      createNode: "Vytvořit nový uzel",
      createCircle: "Vytvořit kruh",
      nodeTypes: "Typy uzlů",
      exportText: "Exportovat text",
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
  theme: { toggleToLight: "Přepnout na světlý režim", toggleToDark: "Přepnout na tmavý režim" },
  language: { label: "Jazyk" },
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
      owner: "Власник",
    },
    menu: { summary: "Підсумок", edit: "Редагувати", invite: "Запросити", delete: "Видалити" },
    deleteConfirm: (name) => `Видалити «${name}»? Це також видалить усі вузли на ній.`,
    createModal: {
      title: "Нова карта",
      name: "Назва",
      ownerColor: "Ваш колір на цій карті",
      boardColor: "Колір дошки",
      startingPoint: "Початкова точка",
      templates: {
        blank: { label: "Порожнє полотно", desc: "Почати з нуля." },
        singleProblem: { label: "Одна проблема", desc: "Один кореневий вузол для розгалуження." },
        decisionTree: { label: "Дерево рішень", desc: "Проблема з двома вже розгалуженими варіантами." },
        proCon: { label: "За / Проти", desc: "Тема з однією гілкою «за» та однією «проти»." },
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
        "Режим обговорення: увімкнено — бій (атака/захист) видимий. Натисніть, щоб перейти в особистий режим.",
      personalTooltip:
        "Особистий режим: увімкнено — бій (атака/захист) прихований для самостійної роботи. Натисніть, щоб повернутися в режим обговорення.",
      zoomOut: "Зменшити",
      zoomReset: "Скинути масштаб",
      zoomIn: "Збільшити",
      expandToolbar: "Показати панель інструментів",
      readingMode: "Режим читання",
      readingClassic: "Класична ментальна карта",
      readingIconText: "Іконки + текст",
      readingActual: "Поточний",
    },
    addMenu: {
      invite: "Запросити користувача",
      createNode: "Створити новий вузол",
      createCircle: "Створити коло",
      nodeTypes: "Типи вузлів",
      exportText: "Експортувати текст",
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
  theme: { toggleToLight: "Перемкнути на світлий режим", toggleToDark: "Перемкнути на темний режим" },
  language: { label: "Мова" },
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
      owner: "Владелец",
    },
    menu: { summary: "Сводка", edit: "Изменить", invite: "Пригласить", delete: "Удалить" },
    deleteConfirm: (name) => `Удалить «${name}»? Это также удалит все узлы на ней.`,
    createModal: {
      title: "Новая карта",
      name: "Название",
      ownerColor: "Ваш цвет на этой карте",
      boardColor: "Цвет доски",
      startingPoint: "Отправная точка",
      templates: {
        blank: { label: "Пустой холст", desc: "Начать с нуля." },
        singleProblem: { label: "Одна проблема", desc: "Один корневой узел для ветвления." },
        decisionTree: { label: "Дерево решений", desc: "Проблема с двумя уже разветвлёнными вариантами." },
        proCon: { label: "За / Против", desc: "Тема с одной веткой «за» и одной «против»." },
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
        "Режим обсуждения: включён — бой (атака/защита) виден. Нажмите, чтобы переключиться в личный режим.",
      personalTooltip:
        "Личный режим: включён — бой (атака/защита) скрыт для самостоятельной работы. Нажмите, чтобы вернуться в режим обсуждения.",
      zoomOut: "Уменьшить",
      zoomReset: "Сбросить масштаб",
      zoomIn: "Увеличить",
      expandToolbar: "Показать панель инструментов",
      readingMode: "Режим чтения",
      readingClassic: "Классическая ментальная карта",
      readingIconText: "Иконки + текст",
      readingActual: "Текущий",
    },
    addMenu: {
      invite: "Пригласить пользователя",
      createNode: "Создать новый узел",
      createCircle: "Создать круг",
      nodeTypes: "Типы узлов",
      exportText: "Экспортировать текст",
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
  theme: { toggleToLight: "Переключить на светлую тему", toggleToDark: "Переключить на тёмную тему" },
  language: { label: "Язык" },
};

export const TRANSLATIONS: Record<Language, Translation> = { en, cs, uk, ru };
