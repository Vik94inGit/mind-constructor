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
      usernameHint: string;
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
    /** The dashboard's quick note box (dashboard/QuickNote.tsx). */
    /** The main menu: a node with a ring of ghosts (dashboard/MenuNode.tsx). */
    ring: {
      label: string;
      center: string;
      lastStop: string;
      quickNote: string;
      unsorted: (count: number) => string;
      newMap: string;
      newFolder: string;
      split: string;
    };
    quickNote: { title: string; placeholder: string; save: string; saved: string; open: (mapName: string) => string; error: string; inboxName: string };
    library: {
      newFolder: string;
      search: string;
      noResults: (query: string) => string;
      /** Search across every map's nodes (dashboard/ThoughtResults.tsx). */
      thoughts: string;
      thoughtIn: (mapName: string) => string;
      thoughtsError: string;
      allMaps: string;
      folderEmpty: string;
      prev: string;
      next: string;
      page: (page: number, total: number) => string;
      foldersError: string;
      deleteMapError: string;
      resume: { title: string; open: string };
      /** The first map made from a template, on top of the dashboard, with the latest thoughts under it (dashboard/FirstMapCard.tsx). */
      firstMap: { title: string; open: string; latest: string; none: string; inMap: (mapName: string) => string; error: string };
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
        empty: { label: string; desc: string };
        problem: { label: string; desc: string };
        decision: { label: string; desc: string };
        goal: { label: string; desc: string };
        retro: { label: string; desc: string };
        idea: { label: string; desc: string };
        study: { label: string; desc: string };
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
      /** Select mode (☑): taps only pick nodes; left only by Done or ☑ again. */
      selectOn: string;
      selectOff: string;
      discussionTooltip: string;
      personalTooltip: string;
      /** Battle mode while offline: paused, the toggle can't be used. */
      discussionOffline: string;
      presentation: string;
      zoomOut: string;
      zoomReset: string;
      fitMap: string;
      zoomIn: string;
      expandToolbar: string;
      more: string;
      displayMenu: string;
      undo: string;
      /** The display menu's entry and the bar that replays the map node by node, oldest first. */
      timeLapse: string;
      timeLapsePlay: string;
      timeLapsePause: string;
      timeLapsePrev: string;
      timeLapseNext: string;
      timeLapseExit: string;
      timeLapseSpeed: string;
      timeLapseSpeeds: Record<"slow" | "normal" | "fast", string>;
      timeLapseStep: (shown: number, total: number) => string;
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
    /** A piece hangs from the main node, another piece, or (on a map) a node already there. */
    hangsFrom: string;
    piecesGroup: string;
    mapGroup: string;
    /** No parent at all. */
    noParent: string;
    selected: string;
    clearSelection: string;
    overlap: string;
    pieces: (count: number) => string;
    /** Shown once a piece's first word is tapped, until its last one is. */
    startAt: (word: string) => string;
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
      usernameHint: "Optional — leave empty to use your email up to the @",
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
    ring: {
      label: "Main menu",
      center: "What's on your mind?",
      lastStop: "Last stop",
      quickNote: "Quick note",
      unsorted: (count) => `Unsorted notes (${count})`,
      newMap: "New map",
      newFolder: "New folder",
      split: "Text → map",
    },
    quickNote: { title: "Quick note", placeholder: "Jot a thought — it goes to your Inbox map…", save: "Save", saved: "Saved.", open: (name) => `Open ${name} →`, error: "Couldn't save the note", inboxName: "Inbox" },
    library: {
      newFolder: "+ New folder",
      search: "Search maps, folders and thoughts…",
      thoughts: "Thoughts",
      thoughtIn: (mapName) => `in “${mapName}”`,
      thoughtsError: "Searching your thoughts failed",
      noResults: (query) => `Nothing matches "${query}".`,
      allMaps: "All maps",
      folderEmpty: "This folder is empty. Move maps here from their ⋯ menu.",
      prev: "‹ Prev",
      next: "Next ›",
      page: (page, total) => `Page ${page} of ${total}`,
      foldersError: "Failed to load folders",
      deleteMapError: "Couldn't delete the map",
      resume: { title: "Continue where you left off", open: "Open" },
      firstMap: {
        title: "Your map",
        open: "Open map",
        latest: "Latest thoughts",
        none: "Nothing written yet. Open the map and answer its questions.",
        inMap: (mapName) => `in “${mapName}”`,
        error: "Couldn't load this map's thoughts",
      },
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
        empty: { label: "Empty map", desc: "A blank canvas with no nodes. Start from nothing and add your own." },
        problem: { label: "Problem analysis", desc: "Break a problem into parts, weigh ways to solve it, plan and check the result." },
        decision: { label: "Decision", desc: "Compare options with their advantages and risks." },
        goal: { label: "Goal planning", desc: "A goal with success criteria, steps, obstacles and a review." },
        retro: { label: "Retrospective", desc: "What went well, what did not, and what to change." },
        idea: { label: "Idea", desc: "Grow an idea in three rounds: what it is and why, how to make it happen, then how it went." },
        study: { label: "Study", desc: "A topic in titles and questions: what it is, its main parts, examples, and what an exam would ask." },
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
      selectOn: "Select mode: on — tap nodes to pick them; press Done to leave",
      selectOff: "Select mode: off — turn on to pick nodes with taps",
      discussionTooltip:
        "Battle mode: on — attacks do damage, and members other than the owner are limited in what they can attack with. Click to switch to Creating mode.",
      personalTooltip:
        "Creating mode: on — attacks are decoration only and do no damage; no shields. Click to switch back to Battle mode.",
      discussionOffline:
        "Battle mode is off while you're offline: it needs the server and the other members. It comes back once you're online.",
      presentation: "Present — step through the map as slides",
      zoomOut: "Zoom out",
      zoomReset: "Reset zoom",
      fitMap: "Fit the whole map on screen",
      zoomIn: "Zoom in",
      expandToolbar: "Show toolbar",
      more: "More tools",
      displayMenu: "Display options",
      undo: "Undo last move (Ctrl+Z)",
      timeLapse: "Time-lapse — watch the map grow",
      timeLapsePlay: "Play",
      timeLapsePause: "Pause",
      timeLapsePrev: "Previous node",
      timeLapseNext: "Next node",
      timeLapseExit: "Close",
      timeLapseSpeed: "Replay speed",
      timeLapseSpeeds: { slow: "Slow", normal: "Normal", fast: "Fast" },
      timeLapseStep: (n, total) => `${n} of ${total} nodes`,
      readingPuzzle: "Cards",
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
    markHint: "Tap the word a piece starts on, then the word it ends on, and choose what it is. It splits off as its own bubble and becomes a node under the main one; then mark the next.",
    mainNode: "Main node — the whole text",
    hangsFrom: "Hangs from",
    piecesGroup: "Pieces",
    mapGroup: "On the map",
    noParent: "Nothing",
    selected: "Selected",
    clearSelection: "Clear selection",
    overlap: "That overlaps a piece you already marked — remove it first or select something else.",
    pieces: (count) => `Pieces (${count})`,
    startAt: (word) => `Starts at “${word}” — now tap the word it ends on.`,
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

// Only English ships in the main bundle; the other languages live in
// locales/<language>.ts and load when picked (translations.ts loadTranslation).
export const TRANSLATIONS: { en: Translation } = { en };

const LOCALES: Record<Exclude<Language, "en">, () => Promise<{ default: Translation }>> = {
  cs: () => import("./locales/cs"),
  uk: () => import("./locales/uk"),
  ru: () => import("./locales/ru"),
};

/** A language's strings: English at once, the others as their own chunk. */
export async function loadTranslation(language: Language): Promise<Translation> {
  return language === "en" ? en : (await LOCALES[language]()).default;
}
