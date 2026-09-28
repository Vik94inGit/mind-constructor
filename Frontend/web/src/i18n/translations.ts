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
      readingClassic: string;
      readingIconText: string;
      readingActual: string;
    };
    addMenu: {
      invite: string;
      createNode: string;
      createCircle: string;
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
      readingClassic: "Classical mind map",
      readingIconText: "Icons + text",
      readingActual: "Actual",
    },
    addMenu: {
      invite: "Invite user",
      createNode: "Create new node",
      createCircle: "Create circle",
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
      readingClassic: "Klasická myšlenková mapa",
      readingIconText: "Ikony + text",
      readingActual: "Aktuální",
    },
    addMenu: {
      invite: "Pozvat uživatele",
      createNode: "Vytvořit nový uzel",
      createCircle: "Vytvořit kruh",
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
      readingClassic: "Класична ментальна карта",
      readingIconText: "Іконки + текст",
      readingActual: "Поточний",
    },
    addMenu: {
      invite: "Запросити користувача",
      createNode: "Створити новий вузол",
      createCircle: "Створити коло",
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
      readingClassic: "Классическая ментальная карта",
      readingIconText: "Иконки + текст",
      readingActual: "Текущий",
    },
    addMenu: {
      invite: "Пригласить пользователя",
      createNode: "Создать новый узел",
      createCircle: "Создать круг",
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
  ui: UI_STRINGS.ru,
};

export const TRANSLATIONS: Record<Language, Translation> = { en, cs, uk, ru };
