import type { Language } from "./translations";
import type { NodeType } from "../types";
import type { TemplateNodeKey } from "../utils/templates";

// The rest of the app's user-facing text — panels, menus, modals, and the
// messages shown when something goes wrong. translations.ts keeps the core
// chrome (auth, dashboard, toolbar, tab labels); this covers the deeper copy.
// Same rules as there: interpolated strings are plain functions, so every
// language is checked against the exact same shape by TypeScript itself.
//
// Not translated on purpose: a server's own error text (shown as
// received; the strings below are only the fallbacks for when there isn't
// one), and the markdown a text export generates.
export interface UiStrings {
  common: {
    cancel: string;
    close: string;
    delete: string;
    copy: string;
    copied: string;
    loading: string;
    reset: string;
    edit: string;
    done: string;
  };
  visibility: { hide: string; show: string; hint: string; badge: string };
  search: { title: string; placeholder: string; none: string; found: (count: number) => string };
  compact: { label: string; hint: string };
  types: Record<NodeType, string>;
  templates: {
    section: string;
    problem: { button: string; hint: string };
    goal: { button: string; hint: string };
    retry: { title: string; hint: string; button: string };
    created: (count: number) => string;
    failed: string;
    nodes: Record<TemplateNodeKey, { title: string; text: string }>;
  };
  contextMenu: { createBranch: string; update: string; choose: string; delete: string; attack: string };
  selection: {
    tapToChoose: string;
    finishHint: string;
    chosen: (count: number) => string;
    selected: (count: number) => string;
    actions: string;
    link: string;
    number: string;
    clearNumbers: string;
    numberTitle: string;
    copy: string;
    copyText: string;
    groupCircle: string;
    deleteN: (count: number) => string;
    deselect: string;
    needTwoToLink: string;
    needTwoToGroup: string;
    deleteConfirm: (count: number) => string;
  };
  pack: {
    pickToPack: string;
    picked: (count: number) => string;
    hintBefore: string;
    hintAfter: string;
    removeTitle: string;
    packN: (count: number) => string;
    pickAtLeastOne: string;
    onlyLinked: string;
  };
  link: {
    titleTwo: string;
    titleN: (count: number) => string;
    sentiment: string;
    linking: string;
    createLink: string;
    createLinks: (count: number) => string;
    failed: string;
  };
  invite: {
    title: (mapName: string) => string;
    loadingMembers: string;
    everyoneMember: string;
    user: string;
    choose: string;
    inviting: string;
    invite: string;
    invited: (username: string | null) => string;
    failed: string;
    membersFailed: string;
  };
  sentiments: { neutral: string; positive: string; negative: string };
  node: {
    byUser: (name: string) => string;
    root: string;
    healthLine: (health: number, defeated: boolean) => string;
    pointsAt: string;
    protects: string;
    blocked: (damage: number, target: string | null) => string;
    protectedBy: string;
    title: string;
    titlePlaceholder: string;
    order: string;
    orderPlaceholder: string;
    orderTitle: string;
    orderBadge: (order: number) => string;
    type: string;
    edit: string;
    editTitle: string;
    pack: string;
    packTitle: string;
    size: string;
    zone: string;
    zoneTitle: (zone: "positive" | "negative") => string;
    zoneRemoveTitle: string;
    reset: string;
    symbol: string;
    symbolCheckTitle: string;
    symbolCrossTitle: string;
    symbolResetTitle: string;
    chooseNodes: string;
    chooseNodesTitle: string;
    noLinks: string;
    extractText: string;
    extractTextTitle: string;
    expand: string;
    collapse: string;
    expandTitle: string;
    collapseTitle: string;
    deleteConfirm: string;
    selectToSeeHealth: string;
    circleParent: (sentiment: string) => string;
    variantParent: (sentiment: string) => string;
    zoneName: string;
    zoneNamePlaceholder: string;
    clickToChangeType: string;
    chooseHint: string;
    ghostAgain: string;
  };
  attack: {
    intro: string;
    introWeapon: string;
    introShielded: string;
    objection: string;
    placeholder: string;
    as: string;
    writeObjection: string;
    writeFirst: string;
    weapons: { nitpick: string; counterpoint: string; fatalFlaw: string };
    hintNegativeTarget: string;
    hintPositiveTarget: string;
    hintPersonal: string;
  };
  protect: {
    intro: string;
    why: string;
    placeholder: string;
    as: string;
    add: string;
    writeFirst: string;
    onlyOwner: (name: string) => string;
  };
  packed: { empty: string; unpack: string };
  history: { loading: string; none: string };
  errors: {
    clipboard: string;
    symbol: string;
    text: string;
    title: string;
    order: string;
    numberNodes: string;
    delete: string;
    attack: string;
    protect: string;
    unpack: string;
    size: string;
    type: string;
    zone: string;
    removeLink: string;
    loadMap: string;
    mapNotFound: string;
    moveNodes: string;
    joinCircle: string;
    leaveCircle: string;
    dropOnOwnBranch: string;
    cannotJoin: string;
    pullOut: string;
    chooseOwn: string;
    update: string;
    createNode: string;
    paste: string;
    deleteSelected: string;
    groupCircle: string;
    groupPartial: (grouped: number, total: number, skipped: number) => string;
    createCircle: string;
    releaseCircle: string;
    updateCircle: string;
    changeMode: string;
    pack: string;
    loadSummary: string;
    loadUsers: string;
    action: string;
    wipe: string;
  };
  loadingMap: string;
  /** Showing the chosen nodes in their own reading mode, zooming in when their text would overlap. */
  display: { header: string; followMap: string; zoomedToFit: string; stillOverlap: string };
  /** Separator lines drawn between groups of nodes. */
  lines: {
    toolbar: string;
    hintStart: string;
    crossing: string;
    hintPoints: (count: number) => string;
    blocked: string;
    undo: string;
    finish: string;
    exit: string;
    deleteTitle: string;
    deleteConfirm: string;
    createFailed: string;
    deleteFailed: string;
  };
  /** Copy/paste of nodes — chosen ones, or a whole map — between maps. */
  clipboard: {
    copyMap: string;
    copied: (count: number) => string;
    mapCopied: (count: number, mapName: string) => string;
    mapEmpty: (mapName: string) => string;
    nothingToCopy: string;
    nothingToPaste: string;
    pasted: (count: number) => string;
    copyWholeMap: string;
    paste: (count: number) => string;
    pasteHere: (count: number) => string;
    storeFailed: string;
    copyFailed: string;
  };
  /** The dashboard card's members / owner popups. */
  people: {
    membersTitle: (mapName: string) => string;
    ownerTitle: (mapName: string) => string;
    owner: string;
    you: string;
    noMembers: string;
    unknown: string;
  };
  /** Leaving a demo session (its account and map are throwaway) to log in or register. */
  demo: { exit: string; exitTitle: string; exitConfirm: string };
  /** Tooltips on the zone/branch shapes that stabilize a circle, and the text of nodes the app creates itself. */
  canvas: {
    stabilized: string;
    stabilizeZone: string;
    stabilizeCircle: string;
    newCircleText: string;
    newNodeText: string;
  };
  minimapTitle: string;
  panelDragHandle: string;
  exportText: { title: (mapName: string) => string; download: string };
  summary: { title: (mapName: string) => string; nodes: (count: number) => string; members: (count: number) => string };
  cardMenuLabel: string;
  admin: {
    title: string;
    subtitle: string;
    wipe: string;
    loading: string;
    username: string;
    email: string;
    role: string;
    status: string;
    admin: string;
    blocked: string;
    active: string;
    block: string;
    unblock: string;
    delete: string;
    deleteConfirm: (username: string) => string;
    wipeConfirm: string;
    wipeConfirmAgain: string;
  };
}

// Czech: 1 / 2–4 / 5+.
const csPlural = (n: number, one: string, few: string, many: string) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);
// Ukrainian and Russian share the same three forms (1, 21, … / 2–4, 22–24, … / the rest).
const slavicPlural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

const en: UiStrings = {
  common: {
    cancel: "Cancel",
    close: "Close",
    delete: "Delete",
    copy: "Copy",
    copied: "Copied ✓",
    loading: "Loading…",
    reset: "Reset",
    edit: "Edit",
    done: "Done",
  },
  visibility: { hide: "Hide this branch from invited users", show: "Show this branch to invited users", hint: "Invited members cannot see this node or anything hanging from it. You always see it.", badge: "Hidden from invited users" },
  search: { title: "Search nodes", placeholder: "Find a node by its title or text", none: "Nothing found", found: (n) => `${n} found` },
  compact: { label: "Simplified view", hint: "Smaller icons, no halo or horns, no circle rings — less clutter on a small screen" },
  types: {
    Problem: "Problem",
    "Problematic option": "Problematic option",
    Solution: "Solution (goal)",
    Option: "Option",
    Success: "Success",
    Fail: "Fail",
    unknown: "Question (unknown)",
  },
  templates: {
    section: "Templates",
    problem: { button: "Analyze this problem", hint: "Adds sub-problems, the risk of doing nothing, past experience, ways to solve, a plan and its result." },
    goal: { button: "Plan this goal", hint: "Adds a success criterion, ordered steps, an obstacle with a fallback, and a review." },
    retry: { title: "This did not work out", hint: "Find out why, then choose what to change before trying again.", button: "Analyze and try again" },
    created: (n) => `Added ${n} ${n === 1 ? "node" : "nodes"}`,
    failed: "Could not add the template",
    nodes: {
      subProblem1: { title: "Sub-problem 1", text: "Which part of the problem is broken? (one cause per node)" },
      subProblem2: { title: "Sub-problem 2", text: "What else contributes to it?" },
      negativeScenario: { title: "If we do nothing", text: "What is the worst that happens if this is left as it is?" },
      experiencePositive: { title: "What worked", text: "What have we already tried that helped?" },
      experienceNegative: { title: "What did not work", text: "What have we already tried that failed, and why?" },
      way1: { title: "Way to solve 1", text: "One possible way to solve it" },
      way2: { title: "Way to solve 2", text: "An alternative way to solve it" },
      plan: { title: "Plan", text: "Who does what, and by when?" },
      resultPositive: { title: "Result: it worked", text: "What exactly improved? How do we know?" },
      resultNegative: { title: "Result: it failed", text: "What went wrong? (then analyze and try again)" },
      criteria: { title: "Success criterion", text: "How will we know the goal is reached? Make it measurable." },
      step1: { title: "Step 1", text: "The first concrete action" },
      step2: { title: "Step 2", text: "The next action" },
      step3: { title: "Step 3", text: "The last action before the goal" },
      obstacle: { title: "Obstacle", text: "What could stop us?" },
      fallback: { title: "Fallback", text: "What do we do if that happens?" },
      review: { title: "Review", text: "When do we check progress, and who decides?" },
      whyFailed: { title: "Why did it fail?", text: "Ask why, then ask why again — until you reach the real cause." },
      tryAgain: { title: "Try again", text: "What will we change this time?" },
      rootProblem: { title: "The problem", text: "What exactly is the problem, and who does it affect?" },
      rootGoal: { title: "The goal", text: "What do we want to achieve, and by when?" },
      rootDecision: { title: "The decision", text: "What do we have to decide?" },
      rootRetro: { title: "The review", text: "What are we looking back at?" },
      criteriaQuestion: { title: "What matters most?", text: "Which criteria will decide it — cost, time, risk, quality?" },
      optionA: { title: "Option A", text: "One possible choice" },
      advantageA: { title: "Advantage of A", text: "What speaks for it?" },
      riskA: { title: "Risk of A", text: "What could go wrong with it?" },
      optionB: { title: "Option B", text: "One possible choice" },
      advantageB: { title: "Advantage of B", text: "What speaks for it?" },
      riskB: { title: "Risk of B", text: "What could go wrong with it?" },
      optionC: { title: "Option C", text: "One possible choice" },
      advantageC: { title: "Advantage of C", text: "What speaks for it?" },
      riskC: { title: "Risk of C", text: "What could go wrong with it?" },
      wentWell1: { title: "What went well", text: "Something that worked and is worth repeating" },
      wentWell2: { title: "Another success", text: "What else went well?" },
      wentBad1: { title: "What went badly", text: "Something that did not work, and why" },
      wentBad2: { title: "Another problem", text: "What else went wrong?" },
      tryNext1: { title: "Change 1", text: "One thing we will do differently" },
      tryNext2: { title: "Change 2", text: "Another change to try" },
    },
  },
  contextMenu: { createBranch: "Create branch", update: "Update", choose: "Choose…", delete: "Delete", attack: "Attack" },
  selection: {
    tapToChoose: "Tap your nodes to choose them",
    finishHint: "A parent brings its whole branch (Shift+tap: only that node). Tap outside or press Enter when done.",
    chosen: (n) => `${n} node${n === 1 ? "" : "s"} chosen`,
    selected: (n) => `${n} node${n === 1 ? "" : "s"} selected`,
    actions: "Actions",
    link: "Link",
    number: "Number in order",
    clearNumbers: "Remove numbers",
    numberTitle: "Number the chosen nodes 1, 2, 3… in the order you chose them",
    copy: "Copy",
    copyText: "Copy as text",
    groupCircle: "Group into circle",
    deleteN: (n) => `Delete ${n} node${n === 1 ? "" : "s"}`,
    deselect: "Deselect",
    needTwoToLink: "Choose at least 2 nodes to link them",
    needTwoToGroup: "Select at least 2 nodes to group them",
    deleteConfirm: (n) => `Delete ${n} node${n === 1 ? "" : "s"}?`,
  },
  pack: {
    pickToPack: "Pick nodes to pack",
    picked: (n) => `${n} picked`,
    hintBefore: "Tap a node linked or branched to ",
    hintAfter: " to add or remove it — everything picked folds into it and disappears from the canvas.",
    removeTitle: "Remove from this pack",
    packN: (n) => `Pack ${n} node${n === 1 ? "" : "s"}`,
    pickAtLeastOne: "Pick at least 1 node",
    onlyLinked: "Only nodes linked or branched to the container can be packed.",
  },
  link: {
    titleTwo: "Link nodes",
    titleN: (n) => `Link ${n} nodes`,
    sentiment: "Sentiment",
    linking: "Linking…",
    createLink: "Create link",
    createLinks: (n) => `Create ${n} links`,
    failed: "Failed to create link",
  },
  invite: {
    title: (name) => `Invite to "${name}"`,
    loadingMembers: "Loading current members…",
    everyoneMember: "Everyone is already a member.",
    user: "User",
    choose: "Choose a user…",
    inviting: "Inviting…",
    invite: "Invite",
    invited: (username) => `${username ?? "User"} invited.`,
    failed: "Failed to invite",
    membersFailed: "Failed to load current members",
  },
  sentiments: { neutral: "neutral", positive: "positive", negative: "negative" },
  node: {
    byUser: (name) => `by ${name}`,
    root: "root",
    healthLine: (h, defeated) => `${h}/100 health${defeated ? " · defeated" : ""}`,
    pointsAt: "Points at",
    protects: "Protects",
    blocked: (d, target) =>
      `Blocked ${d} damage so far — deleting this shield returns all of it to ${target ?? "the node it defends"} at once.`,
    protectedBy: "Protected by",
    title: "Title:",
    titlePlaceholder: "Optional — otherwise the first words of the text show",
    order: "Step:",
    orderPlaceholder: "1, 2, 3…",
    orderTitle: "Step number — label nodes 1, 2, 3… to describe a process",
    orderBadge: (n) => `Step ${n}`,
    type: "Type:",
    edit: "Edit",
    editTitle: "Open the canvas's own inline editor (text + type)",
    pack: "Pack…",
    packTitle: "Fold other linked/branched nodes into this one",
    size: "Size:",
    zone: "Zone:",
    zoneTitle: (z) => `Draw a ${z} zone ring around just this node`,
    zoneRemoveTitle: "Remove this manual zone ring",
    reset: "Reset",
    symbol: "Symbol:",
    symbolCheckTitle: "Force a check mark, regardless of type",
    symbolCrossTitle: "Force a cross, regardless of type",
    symbolResetTitle: "Use this type's own default symbol",
    chooseNodes: "Choose nodes…",
    chooseNodesTitle: "Choose this node and others, then link, copy or delete them together",
    noLinks: "No links yet.",
    extractText: "Extract text…",
    extractTextTitle:
      "Export this node's own cluster's text — plus any cluster rooted at one of its children, recursively. The whole map's own text export moved to the + toolbar menu.",
    expand: "Expand",
    collapse: "Collapse",
    expandTitle: "Expand to show the whole text, no inner scrollbar",
    collapseTitle: "Collapse back to a scrollable box",
    deleteConfirm: "Delete this node?",
    selectToSeeHealth: "Select to see health",
    circleParent: (s) => `Circle parent (${s})`,
    variantParent: (s) => `Variant parent (${s})`,
    zoneName: "Zone name:",
    zoneNamePlaceholder: "Name this zone",
    clickToChangeType: "Click to change type",
    chooseHint: "choose?",
    ghostAgain: "click again to add",
  },
  attack: {
    intro: "Landing an attack creates a real node with your objection, linked to this one by a weapon arrow.",
    introWeapon: " Landing this heals its own target's parent.",
    introShielded: " This node is currently shielded — attacks will be blocked.",
    objection: "Your objection",
    placeholder: "Why does this fail?",
    as: "As a",
    writeObjection: "Write your objection above to pick a weapon.",
    writeFirst: "Write your objection first",
    weapons: { nitpick: "Nitpick", counterpoint: "Counterpoint", fatalFlaw: "Fatal flaw" },
    hintNegativeTarget: "Battle mode: you answer a negative node with a positive one (Solution, Option or Success).",
    hintPositiveTarget: "Battle mode: you challenge a positive node with a question or a negative Problem / Problematic option.",
    hintPersonal: "Creating mode: an attack only adds the node — it does no damage.",
  },
  protect: {
    intro: "A protection node fully blocks every future attack on this node while it stays undefeated — no limit, no cooldown.",
    why: "Why it's defended",
    placeholder: "Why does this hold up?",
    as: "As a",
    add: "Add protection",
    writeFirst: "Write why it's defended first",
    onlyOwner: (name) => `Only ${name} can add a protection node to this one.`,
  },
  packed: { empty: "Nothing packed in here.", unpack: "Unpack" },
  history: { loading: "Loading…", none: "No attacks yet." },
  errors: {
    clipboard: "Copy failed — this browser blocked clipboard access.",
    symbol: "Failed to update symbol",
    text: "Failed to update text",
    title: "Failed to update title",
    order: "Failed to update the step number",
    numberNodes: "Failed to number the selected nodes",
    delete: "Delete failed",
    attack: "Attack failed",
    protect: "Protect failed",
    unpack: "Unpack failed",
    size: "Failed to update size",
    type: "Failed to update type",
    zone: "Failed to update zone",
    removeLink: "Failed to remove link",
    loadMap: "Failed to load map",
    mapNotFound: "Map not found",
    moveNodes: "Failed to move the selected nodes",
    joinCircle: "Failed to join circle",
    leaveCircle: "Failed to leave circle",
    dropOnOwnBranch: "Can't drop a node onto its own branch.",
    cannotJoin: "Can't join that circle.",
    pullOut: "Can't pull it out — the remaining circle would get a corner under 30°.",
    chooseOwn: "You can only choose nodes you created.",
    update: "Update failed",
    createNode: "Failed to create node",
    paste: "Failed to paste",
    deleteSelected: "Failed to delete the selected nodes",
    groupCircle: "Failed to group into a circle",
    groupPartial: (grouped, total, skipped) =>
      `Grouped ${grouped} of ${total} node${total === 1 ? "" : "s"} — ${skipped} would have closed a loop and ${skipped === 1 ? "was" : "were"} left alone.`,
    createCircle: "Failed to create a circle",
    releaseCircle: "Failed to release the stabilized circle",
    updateCircle: "Failed to update the stabilized circle",
    changeMode: "Failed to change map mode",
    pack: "Pack failed",
    loadSummary: "Failed to load summary",
    loadUsers: "Failed to load users",
    action: "Action failed",
    wipe: "Wipe failed",
  },
  loadingMap: "Loading map…",
  display: {
    header: "Show chosen nodes as",
    followMap: "Same as the map",
    zoomedToFit: "Zoomed in so the nodes don't overlap.",
    stillOverlap: "Zoomed in as far as possible — a few nodes still overlap.",
  },
  lines: {
    toolbar: "Draw a separator line",
    hintStart: "Click empty spots to place the line's points. It can't run over nodes or zones, but it can join other lines.",
    crossing: "That stretch would run over a node or zone — pick a spot that keeps the line clear.",
    hintPoints: (n) => `${n} point${n === 1 ? "" : "s"} placed — Enter to finish, Backspace to undo, Esc to clear.`,
    blocked: "That spot is on a node or zone — pick an empty one.",
    undo: "Undo",
    finish: "Finish line",
    exit: "Exit",
    deleteTitle: "Click to delete this line",
    deleteConfirm: "Delete this line?",
    createFailed: "Failed to draw the line",
    deleteFailed: "Failed to delete the line",
  },
  clipboard: {
    copyMap: "Copy map content",
    copied: (n) => `Copied ${n} node${n === 1 ? "" : "s"}. Open a map and paste with Ctrl+V, or + > Paste.`,
    mapCopied: (n, mapName) => `Copied ${n} node${n === 1 ? "" : "s"} from "${mapName}". Open another map and paste with Ctrl+V, or + > Paste.`,
    mapEmpty: (mapName) => `"${mapName}" has nothing to copy.`,
    nothingToCopy: "Nothing to copy.",
    nothingToPaste: "Nothing to paste — copy some nodes, or a whole map, first.",
    pasted: (n) => `Pasted ${n} node${n === 1 ? "" : "s"}.`,
    copyWholeMap: "Copy whole map",
    paste: (n) => `Paste ${n} node${n === 1 ? "" : "s"}`,
    pasteHere: (n) => `Paste ${n} node${n === 1 ? "" : "s"} here`,
    storeFailed: "Couldn't keep the copy — this browser blocked storage.",
    copyFailed: "Copy failed",
  },
  people: {
    membersTitle: (mapName) => `Members of "${mapName}"`,
    ownerTitle: (mapName) => `Owner of "${mapName}"`,
    owner: "owner",
    you: "you",
    noMembers: "No members yet.",
    unknown: "Unknown user",
  },
  demo: {
    exit: "Exit demo",
    exitTitle: "Leave the demo to log in or register",
    exitConfirm: "Leave the demo? This demo map is temporary and will be lost.",
  },
  canvas: {
    stabilized: "Stabilized — click it, or click anywhere outside it, to let it drift with the others",
    stabilizeZone: "Click to stabilize this zone and let every other zone drift",
    stabilizeCircle: "Click to stabilize this circle and let every other circle drift",
    newCircleText: "New circle",
    newNodeText: "New node",
  },
  minimapTitle: "Minimap — click or drag to jump around the map",
  panelDragHandle: "Drag to move this panel",
  exportText: { title: (name) => `Export text — "${name}"`, download: "Download .md" },
  summary: {
    title: (name) => `Summary — "${name}"`,
    nodes: (n) => `${n} node(s)`,
    members: (n) => `${n} member(s)`,
  },
  cardMenuLabel: "Map menu",
  admin: {
    title: "Admin",
    subtitle: "Manage every registered user.",
    wipe: "Wipe database",
    loading: "Loading users…",
    username: "Username",
    email: "Email",
    role: "Role",
    status: "Status",
    admin: "admin",
    blocked: "blocked",
    active: "active",
    block: "Block",
    unblock: "Unblock",
    delete: "Delete",
    deleteConfirm: (u) => `Delete ${u}? This deletes every map they own.`,
    wipeConfirm: "Wipe the ENTIRE database — all users, maps and nodes? This cannot be undone.",
    wipeConfirmAgain: "Are you absolutely sure? Type-of-no-return confirmation #2.",
  },
};

const csNodes = (n: number) => `${n} ${csPlural(n, "uzel", "uzly", "uzlů")}`;
const cs: UiStrings = {
  common: {
    cancel: "Zrušit",
    close: "Zavřít",
    delete: "Smazat",
    copy: "Kopírovat",
    copied: "Zkopírováno ✓",
    loading: "Načítání…",
    reset: "Obnovit",
    edit: "Upravit",
    done: "Hotovo",
  },
  visibility: { hide: "Skrýt tuto větev pozvaným uživatelům", show: "Zobrazit tuto větev pozvaným uživatelům", hint: "Pozvaní členové tento uzel ani nic, co z něj vychází, neuvidí. Vy jej vidíte vždy.", badge: "Skryto před pozvanými uživateli" },
  search: { title: "Hledat uzly", placeholder: "Najít uzel podle názvu nebo textu", none: "Nic nenalezeno", found: (n) => `Nalezeno: ${n}` },
  compact: { label: "Zjednodušený pohled", hint: "Menší ikony, bez svatozáře a rohů a bez kruhů — méně rušivých prvků na malé obrazovce" },
  types: {
    Problem: "Problém",
    "Problematic option": "Problematická varianta",
    Solution: "Řešení (cíl)",
    Option: "Varianta",
    Success: "Úspěch",
    Fail: "Neúspěch",
    unknown: "Otázka (neznámé)",
  },
  templates: {
    section: "Šablony",
    problem: { button: "Analyzovat tento problém", hint: "Přidá dílčí problémy, riziko nicnedělání, dosavadní zkušenosti, možnosti řešení, plán a jeho výsledek." },
    goal: { button: "Naplánovat tento cíl", hint: "Přidá kritérium úspěchu, očíslované kroky, překážku se záložním plánem a kontrolu." },
    retry: { title: "Nevyšlo to", hint: "Zjistěte proč a rozhodněte, co změnit, než to zkusíte znovu.", button: "Analyzovat a zkusit znovu" },
    created: (n) => `Přidáno: ${csNodes(n)}`,
    failed: "Šablonu se nepodařilo přidat",
    nodes: {
      subProblem1: { title: "Dílčí problém 1", text: "Která část problému nefunguje? (jedna příčina na uzel)" },
      subProblem2: { title: "Dílčí problém 2", text: "Co dalšího k němu přispívá?" },
      negativeScenario: { title: "Když nic neuděláme", text: "Co nejhoršího se stane, když to necháme, jak to je?" },
      experiencePositive: { title: "Co fungovalo", text: "Co jsme už zkusili a pomohlo to?" },
      experienceNegative: { title: "Co nefungovalo", text: "Co jsme už zkusili a nevyšlo to, a proč?" },
      way1: { title: "Možnost řešení 1", text: "Jedna z možných cest k řešení" },
      way2: { title: "Možnost řešení 2", text: "Alternativní cesta k řešení" },
      plan: { title: "Plán", text: "Kdo co udělá a do kdy?" },
      resultPositive: { title: "Výsledek: povedlo se", text: "Co přesně se zlepšilo? Podle čeho to poznáme?" },
      resultNegative: { title: "Výsledek: nepovedlo se", text: "Co se pokazilo? (pak analyzujte a zkuste to znovu)" },
      criteria: { title: "Kritérium úspěchu", text: "Podle čeho poznáme, že je cíl splněn? Ať je měřitelné." },
      step1: { title: "Krok 1", text: "První konkrétní akce" },
      step2: { title: "Krok 2", text: "Další akce" },
      step3: { title: "Krok 3", text: "Poslední akce před cílem" },
      obstacle: { title: "Překážka", text: "Co nás může zastavit?" },
      fallback: { title: "Záložní plán", text: "Co uděláme, když to nastane?" },
      review: { title: "Kontrola", text: "Kdy zkontrolujeme pokrok a kdo rozhoduje?" },
      whyFailed: { title: "Proč to nevyšlo?", text: "Zeptejte se proč a pak znovu proč — až najdete skutečnou příčinu." },
      tryAgain: { title: "Zkusit znovu", text: "Co tentokrát změníme?" },
      rootProblem: { title: "Problém", text: "Co přesně je problém a koho se týká?" },
      rootGoal: { title: "Cíl", text: "Čeho chceme dosáhnout a dokdy?" },
      rootDecision: { title: "Rozhodnutí", text: "O čem se musíme rozhodnout?" },
      rootRetro: { title: "Zhodnocení", text: "Na co se ohlížíme?" },
      criteriaQuestion: { title: "Na čem záleží nejvíc?", text: "Která kritéria rozhodnou — cena, čas, riziko, kvalita?" },
      optionA: { title: "Varianta A", text: "Jedna z možných voleb" },
      advantageA: { title: "Výhoda A", text: "Co pro ni mluví?" },
      riskA: { title: "Riziko A", text: "Co se s ní může pokazit?" },
      optionB: { title: "Varianta B", text: "Jedna z možných voleb" },
      advantageB: { title: "Výhoda B", text: "Co pro ni mluví?" },
      riskB: { title: "Riziko B", text: "Co se s ní může pokazit?" },
      optionC: { title: "Varianta C", text: "Jedna z možných voleb" },
      advantageC: { title: "Výhoda C", text: "Co pro ni mluví?" },
      riskC: { title: "Riziko C", text: "Co se s ní může pokazit?" },
      wentWell1: { title: "Co se povedlo", text: "Něco, co fungovalo a stojí za opakování" },
      wentWell2: { title: "Další úspěch", text: "Co dalšího se povedlo?" },
      wentBad1: { title: "Co se nepovedlo", text: "Něco, co nefungovalo, a proč" },
      wentBad2: { title: "Další problém", text: "Co dalšího se pokazilo?" },
      tryNext1: { title: "Změna 1", text: "Jedna věc, kterou uděláme jinak" },
      tryNext2: { title: "Změna 2", text: "Další změna k vyzkoušení" },
    },
  },
  contextMenu: { createBranch: "Vytvořit větev", update: "Upravit", choose: "Vybrat…", delete: "Smazat", attack: "Napadnout" },
  selection: {
    tapToChoose: "Klepnutím na své uzly je vyberete",
    finishHint: "Rodič vezme celou svou větev (Shift+klepnutí: jen tento uzel). Hotovo: klepněte mimo nebo stiskněte Enter.",
    chosen: (n) => `Vybráno: ${csNodes(n)}`,
    selected: (n) => `Označeno: ${csNodes(n)}`,
    actions: "Akce",
    link: "Propojit",
    number: "Očíslovat popořadě",
    clearNumbers: "Odebrat čísla",
    numberTitle: "Očísluje vybrané uzly 1, 2, 3… v pořadí, v jakém jste je vybrali",
    copy: "Kopírovat",
    copyText: "Kopírovat jako text",
    groupCircle: "Seskupit do kruhu",
    deleteN: (n) => `Smazat ${csNodes(n)}`,
    deselect: "Zrušit výběr",
    needTwoToLink: "Pro propojení vyberte alespoň 2 uzly",
    needTwoToGroup: "Pro seskupení vyberte alespoň 2 uzly",
    deleteConfirm: (n) => `Smazat ${csNodes(n)}?`,
  },
  pack: {
    pickToPack: "Vyberte uzly ke sbalení",
    picked: (n) => `Vybráno: ${n}`,
    hintBefore: "Klepnutím na uzel propojený nebo navazující na ",
    hintAfter: " ho přidáte nebo odeberete — vše vybrané se do něj sbalí a zmizí z plátna.",
    removeTitle: "Odebrat z tohoto balíčku",
    packN: (n) => `Sbalit ${csNodes(n)}`,
    pickAtLeastOne: "Vyberte alespoň 1 uzel",
    onlyLinked: "Sbalit lze jen uzly propojené s kontejnerem nebo na něj navazující.",
  },
  link: {
    titleTwo: "Propojit uzly",
    titleN: (n) => `Propojit ${csNodes(n)}`,
    sentiment: "Zabarvení",
    linking: "Propojování…",
    createLink: "Vytvořit spojení",
    createLinks: (n) => `Vytvořit spojení: ${n}`,
    failed: "Spojení se nepodařilo vytvořit",
  },
  invite: {
    title: (name) => `Pozvat do „${name}“`,
    loadingMembers: "Načítání současných členů…",
    everyoneMember: "Všichni už jsou členy.",
    user: "Uživatel",
    choose: "Vyberte uživatele…",
    inviting: "Zvání…",
    invite: "Pozvat",
    invited: (username) => `${username ?? "Uživatel"} byl(a) pozván(a).`,
    failed: "Pozvání se nepodařilo",
    membersFailed: "Nepodařilo se načíst současné členy",
  },
  sentiments: { neutral: "neutrální", positive: "pozitivní", negative: "negativní" },
  node: {
    byUser: (name) => `od ${name}`,
    root: "kořen",
    healthLine: (h, defeated) => `${h}/100 zdraví${defeated ? " · poražen" : ""}`,
    pointsAt: "Míří na",
    protects: "Chrání",
    blocked: (d, target) =>
      `Dosud zablokováno ${d} poškození — smazáním tohoto štítu se vše vrátí ${target ? `uzlu ${target}` : "chráněnému uzlu"} najednou.`,
    protectedBy: "Chráněno štítem",
    title: "Název:",
    titlePlaceholder: "Volitelné — jinak se zobrazí první slova textu",
    order: "Krok:",
    orderPlaceholder: "1, 2, 3…",
    orderTitle: "Číslo kroku — očíslujte uzly 1, 2, 3… a popište tak postup",
    orderBadge: (n) => `Krok ${n}`,
    type: "Typ:",
    edit: "Upravit",
    editTitle: "Otevřít vestavěný editor na plátně (text + typ)",
    pack: "Sbalit…",
    packTitle: "Sbalit do tohoto uzlu další propojené nebo navazující uzly",
    size: "Velikost:",
    zone: "Zóna:",
    zoneTitle: (z) => (z === "positive" ? "Nakreslit pozitivní zónu jen kolem tohoto uzlu" : "Nakreslit negativní zónu jen kolem tohoto uzlu"),
    zoneRemoveTitle: "Odstranit tuto ručně nakreslenou zónu",
    reset: "Obnovit",
    symbol: "Symbol:",
    symbolCheckTitle: "Vynutit zaškrtnutí bez ohledu na typ",
    symbolCrossTitle: "Vynutit křížek bez ohledu na typ",
    symbolResetTitle: "Použít výchozí symbol tohoto typu",
    chooseNodes: "Vybrat uzly…",
    chooseNodesTitle: "Vyberte tento a další uzly a pak je společně propojte, zkopírujte nebo smažte",
    noLinks: "Zatím žádná spojení.",
    extractText: "Vyextrahovat text…",
    extractTextTitle:
      "Exportovat text clusteru tohoto uzlu — i každého clusteru s kořenem v jeho potomcích. Export textu celé mapy najdete v nabídce + na panelu nástrojů.",
    expand: "Rozbalit",
    collapse: "Sbalit",
    expandTitle: "Rozbalit a zobrazit celý text bez vnitřního posuvníku",
    collapseTitle: "Sbalit zpět do posuvného pole",
    deleteConfirm: "Smazat tento uzel?",
    selectToSeeHealth: "Vyberte pro zobrazení zdraví",
    circleParent: (s) => `Rodič kruhu (${s})`,
    variantParent: (s) => `Rodič varianty (${s})`,
    zoneName: "Název zóny:",
    zoneNamePlaceholder: "Pojmenujte tuto zónu",
    clickToChangeType: "Klepnutím změníte typ",
    chooseHint: "vybrat?",
    ghostAgain: "klepnutím znovu přidáte",
  },
  attack: {
    intro: "Útok vytvoří skutečný uzel s vaší námitkou, propojený s tímto uzlem šípem zbraně.",
    introWeapon: " Zásah tímto uzlem uzdraví rodiče jeho cíle.",
    introShielded: " Tento uzel je právě chráněn štítem — útoky budou zablokovány.",
    objection: "Vaše námitka",
    placeholder: "Proč to selhává?",
    as: "Jako",
    writeObjection: "Napište námitku výše, abyste mohli zvolit zbraň.",
    writeFirst: "Nejdřív napište námitku",
    weapons: { nitpick: "Malichernost", counterpoint: "Protiargument", fatalFlaw: "Fatální chyba" },
    hintNegativeTarget: "Bojový režim: na negativní uzel odpovídáte pozitivním (Řešení, Varianta nebo Úspěch).",
    hintPositiveTarget: "Bojový režim: pozitivní uzel zpochybníte otázkou nebo negativním uzlem Problém / Problematická varianta.",
    hintPersonal: "Tvůrčí režim: útok jen přidá uzel, nezpůsobí žádné poškození.",
  },
  protect: {
    intro: "Ochranný uzel plně blokuje každý další útok na tento uzel, dokud není poražen — bez limitu a bez prodlevy.",
    why: "Proč je bráněn",
    placeholder: "Proč to obstojí?",
    as: "Jako",
    add: "Přidat ochranu",
    writeFirst: "Nejdřív napište, proč je bráněn",
    onlyOwner: (name) => `Ochranný uzel k tomuto může přidat jen ${name}.`,
  },
  packed: { empty: "Nic tu není sbaleno.", unpack: "Rozbalit" },
  history: { loading: "Načítání…", none: "Zatím žádné útoky." },
  errors: {
    clipboard: "Kopírování se nezdařilo — prohlížeč zablokoval přístup ke schránce.",
    symbol: "Symbol se nepodařilo změnit",
    text: "Text se nepodařilo změnit",
    title: "Název se nepodařilo změnit",
    order: "Číslo kroku se nepodařilo změnit",
    numberNodes: "Vybrané uzly se nepodařilo očíslovat",
    delete: "Smazání se nezdařilo",
    attack: "Útok se nezdařil",
    protect: "Ochranu se nepodařilo přidat",
    unpack: "Rozbalení se nezdařilo",
    size: "Velikost se nepodařilo změnit",
    type: "Typ se nepodařilo změnit",
    zone: "Zónu se nepodařilo změnit",
    removeLink: "Spojení se nepodařilo odstranit",
    loadMap: "Mapu se nepodařilo načíst",
    mapNotFound: "Mapa nenalezena",
    moveNodes: "Vybrané uzly se nepodařilo přesunout",
    joinCircle: "Do kruhu se nepodařilo vstoupit",
    leaveCircle: "Kruh se nepodařilo opustit",
    dropOnOwnBranch: "Uzel nelze pustit na jeho vlastní větev.",
    cannotJoin: "K tomuto kruhu se nelze připojit.",
    pullOut: "Nelze vytáhnout — zbylý kruh by měl roh pod 30°.",
    chooseOwn: "Vybírat můžete jen uzly, které jste vytvořili.",
    update: "Úprava se nezdařila",
    createNode: "Uzel se nepodařilo vytvořit",
    paste: "Vložení se nezdařilo",
    deleteSelected: "Vybrané uzly se nepodařilo smazat",
    groupCircle: "Seskupení do kruhu se nezdařilo",
    groupPartial: (grouped, total, skipped) =>
      `Seskupeno ${grouped} z ${total} — vynecháno: ${skipped} (uzavřely by smyčku).`,
    createCircle: "Kruh se nepodařilo vytvořit",
    releaseCircle: "Stabilizovaný kruh se nepodařilo uvolnit",
    updateCircle: "Stabilizovaný kruh se nepodařilo upravit",
    changeMode: "Režim mapy se nepodařilo změnit",
    pack: "Sbalení se nezdařilo",
    loadSummary: "Souhrn se nepodařilo načíst",
    loadUsers: "Uživatele se nepodařilo načíst",
    action: "Akce se nezdařila",
    wipe: "Vymazání se nezdařilo",
  },
  loadingMap: "Načítání mapy…",
  display: {
    header: "Zobrazit vybrané uzly jako",
    followMap: "Stejně jako mapa",
    zoomedToFit: "Přiblíženo, aby se uzly nepřekrývaly.",
    stillOverlap: "Přiblíženo na maximum — několik uzlů se stále překrývá.",
  },
  lines: {
    toolbar: "Nakreslit dělicí čáru",
    hintStart: "Klikejte na volná místa a určete body čáry. Nesmí vést přes uzly ani zóny, ale může navazovat na jiné čáry.",
    crossing: "Tento úsek by vedl přes uzel nebo zónu — vyberte místo, které nechá čáru volnou.",
    hintPoints: (n) => `Bodů: ${n} — Enter dokončí, Backspace vrátí zpět, Esc smaže.`,
    blocked: "Toto místo je na uzlu nebo zóně — vyberte volné.",
    undo: "Zpět",
    finish: "Dokončit čáru",
    exit: "Skončit",
    deleteTitle: "Kliknutím tuto čáru smažete",
    deleteConfirm: "Smazat tuto čáru?",
    createFailed: "Čáru se nepodařilo nakreslit",
    deleteFailed: "Čáru se nepodařilo smazat",
  },
  clipboard: {
    copyMap: "Kopírovat obsah mapy",
    copied: (n) => `Zkopírováno: ${csNodes(n)}. Otevřete mapu a vložte přes Ctrl+V nebo + > Vložit.`,
    mapCopied: (n, mapName) => `Zkopírováno z „${mapName}“: ${csNodes(n)}. Otevřete jinou mapu a vložte přes Ctrl+V nebo + > Vložit.`,
    mapEmpty: (mapName) => `Mapa „${mapName}“ nemá co kopírovat.`,
    nothingToCopy: "Není co kopírovat.",
    nothingToPaste: "Není co vložit — nejdřív zkopírujte uzly nebo celou mapu.",
    pasted: (n) => `Vloženo: ${csNodes(n)}.`,
    copyWholeMap: "Kopírovat celou mapu",
    paste: (n) => `Vložit ${csNodes(n)}`,
    pasteHere: (n) => `Vložit ${csNodes(n)} sem`,
    storeFailed: "Kopii se nepodařilo uchovat — prohlížeč zablokoval úložiště.",
    copyFailed: "Kopírování se nezdařilo",
  },
  people: {
    membersTitle: (mapName) => `Členové mapy „${mapName}“`,
    ownerTitle: (mapName) => `Vlastník mapy „${mapName}“`,
    owner: "vlastník",
    you: "vy",
    noMembers: "Zatím žádní členové.",
    unknown: "Neznámý uživatel",
  },
  demo: {
    exit: "Ukončit demo",
    exitTitle: "Opustit demo a přihlásit se nebo zaregistrovat",
    exitConfirm: "Opustit demo? Tato demo mapa je dočasná a bude ztracena.",
  },
  canvas: {
    stabilized: "Stabilizováno — kliknutím na něj nebo kamkoli mimo něj ho necháte znovu driftovat s ostatními",
    stabilizeZone: "Kliknutím tuto zónu stabilizujete a všechny ostatní zóny necháte driftovat",
    stabilizeCircle: "Kliknutím tento kruh stabilizujete a všechny ostatní kruhy necháte driftovat",
    newCircleText: "Nový kruh",
    newNodeText: "Nový uzel",
  },
  minimapTitle: "Minimapa — kliknutím nebo tažením se přesunete po mapě",
  panelDragHandle: "Přetažením posunete tento panel",
  exportText: { title: (name) => `Export textu — „${name}“`, download: "Stáhnout .md" },
  summary: {
    title: (name) => `Souhrn — „${name}“`,
    nodes: (n) => `${n} uzel(ů)`,
    members: (n) => `${n} člen(ů)`,
  },
  cardMenuLabel: "Nabídka mapy",
  admin: {
    title: "Správa",
    subtitle: "Správa všech registrovaných uživatelů.",
    wipe: "Vymazat databázi",
    loading: "Načítání uživatelů…",
    username: "Uživatelské jméno",
    email: "E-mail",
    role: "Role",
    status: "Stav",
    admin: "admin",
    blocked: "blokován",
    active: "aktivní",
    block: "Zablokovat",
    unblock: "Odblokovat",
    delete: "Smazat",
    deleteConfirm: (u) => `Smazat ${u}? Smaže se každá mapa, kterou vlastní.`,
    wipeConfirm: "Vymazat CELOU databázi — všechny uživatele, mapy a uzly? Nelze vrátit zpět.",
    wipeConfirmAgain: "Opravdu si jste zcela jistí? Potvrzení bez návratu č. 2.",
  },
};

const ukNodes = (n: number) => `${n} ${slavicPlural(n, "вузол", "вузли", "вузлів")}`;
const uk: UiStrings = {
  common: {
    cancel: "Скасувати",
    close: "Закрити",
    delete: "Видалити",
    copy: "Копіювати",
    copied: "Скопійовано ✓",
    loading: "Завантаження…",
    reset: "Скинути",
    edit: "Редагувати",
    done: "Готово",
  },
  visibility: { hide: "Сховати цю гілку від запрошених", show: "Показати цю гілку запрошеним", hint: "Запрошені учасники не бачать цей вузол і все, що від нього відходить. Ви бачите його завжди.", badge: "Приховано від запрошених" },
  search: { title: "Пошук вузлів", placeholder: "Знайти вузол за назвою або текстом", none: "Нічого не знайдено", found: (n) => `Знайдено: ${n}` },
  compact: { label: "Спрощений вигляд", hint: "Менші іконки, без німба й рогів та кілець — менше візуального шуму на малому екрані" },
  types: {
    Problem: "Проблема",
    "Problematic option": "Проблемний варіант",
    Solution: "Рішення (ціль)",
    Option: "Варіант",
    Success: "Успіх",
    Fail: "Невдача",
    unknown: "Питання (невідоме)",
  },
  templates: {
    section: "Шаблони",
    problem: { button: "Проаналізувати цю проблему", hint: "Додає підпроблеми, ризик бездіяльності, попередній досвід, способи вирішення, план і його результат." },
    goal: { button: "Спланувати цю ціль", hint: "Додає критерій успіху, пронумеровані кроки, перешкоду із запасним планом і перевірку." },
    retry: { title: "Не вийшло", hint: "З’ясуйте чому й вирішіть, що змінити, перш ніж пробувати знову.", button: "Проаналізувати й спробувати знову" },
    created: (n) => `Додано: ${ukNodes(n)}`,
    failed: "Не вдалося додати шаблон",
    nodes: {
      subProblem1: { title: "Підпроблема 1", text: "Яка частина проблеми не працює? (одна причина на вузол)" },
      subProblem2: { title: "Підпроблема 2", text: "Що ще до неї призводить?" },
      negativeScenario: { title: "Якщо нічого не робити", text: "Що найгірше станеться, якщо залишити все як є?" },
      experiencePositive: { title: "Що спрацювало", text: "Що ми вже пробували, і це допомогло?" },
      experienceNegative: { title: "Що не спрацювало", text: "Що ми вже пробували, і не вийшло, та чому?" },
      way1: { title: "Спосіб вирішення 1", text: "Один із можливих шляхів вирішення" },
      way2: { title: "Спосіб вирішення 2", text: "Альтернативний шлях вирішення" },
      plan: { title: "План", text: "Хто що робить і до якого терміну?" },
      resultPositive: { title: "Результат: вийшло", text: "Що саме покращилось? Як ми це визначимо?" },
      resultNegative: { title: "Результат: не вийшло", text: "Що пішло не так? (потім проаналізуйте й спробуйте знову)" },
      criteria: { title: "Критерій успіху", text: "Як ми зрозуміємо, що ціль досягнуто? Зробіть його вимірюваним." },
      step1: { title: "Крок 1", text: "Перша конкретна дія" },
      step2: { title: "Крок 2", text: "Наступна дія" },
      step3: { title: "Крок 3", text: "Остання дія перед ціллю" },
      obstacle: { title: "Перешкода", text: "Що може нас зупинити?" },
      fallback: { title: "Запасний план", text: "Що робимо, якщо це станеться?" },
      review: { title: "Перевірка", text: "Коли перевіряємо прогрес і хто вирішує?" },
      whyFailed: { title: "Чому не вийшло?", text: "Запитайте «чому», а потім ще раз «чому» — доки не дійдете до справжньої причини." },
      tryAgain: { title: "Спробувати знову", text: "Що ми змінимо цього разу?" },
      rootProblem: { title: "Проблема", text: "У чому саме проблема і кого вона стосується?" },
      rootGoal: { title: "Ціль", text: "Чого ми хочемо досягти і до якого терміну?" },
      rootDecision: { title: "Рішення", text: "Що нам потрібно вирішити?" },
      rootRetro: { title: "Підсумок", text: "На що ми озираємося?" },
      criteriaQuestion: { title: "Що найважливіше?", text: "Які критерії вирішать — вартість, час, ризик, якість?" },
      optionA: { title: "Варіант A", text: "Один із можливих виборів" },
      advantageA: { title: "Перевага A", text: "Що на його користь?" },
      riskA: { title: "Ризик A", text: "Що може піти не так?" },
      optionB: { title: "Варіант B", text: "Один із можливих виборів" },
      advantageB: { title: "Перевага B", text: "Що на його користь?" },
      riskB: { title: "Ризик B", text: "Що може піти не так?" },
      optionC: { title: "Варіант C", text: "Один із можливих виборів" },
      advantageC: { title: "Перевага C", text: "Що на його користь?" },
      riskC: { title: "Ризик C", text: "Що може піти не так?" },
      wentWell1: { title: "Що вдалося", text: "Те, що спрацювало і варте повторення" },
      wentWell2: { title: "Ще один успіх", text: "Що ще вдалося?" },
      wentBad1: { title: "Що не вдалося", text: "Те, що не спрацювало, і чому" },
      wentBad2: { title: "Ще одна проблема", text: "Що ще пішло не так?" },
      tryNext1: { title: "Зміна 1", text: "Одна річ, яку ми зробимо інакше" },
      tryNext2: { title: "Зміна 2", text: "Ще одна зміна для спроби" },
    },
  },
  contextMenu: { createBranch: "Створити гілку", update: "Змінити", choose: "Обрати…", delete: "Видалити", attack: "Атакувати" },
  selection: {
    tapToChoose: "Торкайтеся своїх вузлів, щоб обрати їх",
    finishHint: "Батько бере всю свою гілку (Shift+торкання: лише цей вузол). Готово: торкніться поза вузлами або натисніть Enter.",
    chosen: (n) => `Обрано: ${ukNodes(n)}`,
    selected: (n) => `Виділено: ${ukNodes(n)}`,
    actions: "Дії",
    link: "З’єднати",
    number: "Пронумерувати по порядку",
    clearNumbers: "Прибрати номери",
    numberTitle: "Нумерує вибрані вузли 1, 2, 3… у порядку вибору",
    copy: "Копіювати",
    copyText: "Копіювати як текст",
    groupCircle: "Згрупувати в коло",
    deleteN: (n) => `Видалити ${ukNodes(n)}`,
    deselect: "Зняти виділення",
    needTwoToLink: "Оберіть щонайменше 2 вузли, щоб їх з’єднати",
    needTwoToGroup: "Виділіть щонайменше 2 вузли, щоб їх згрупувати",
    deleteConfirm: (n) => `Видалити ${ukNodes(n)}?`,
  },
  pack: {
    pickToPack: "Оберіть вузли для згортання",
    picked: (n) => `Обрано: ${n}`,
    hintBefore: "Торкніться вузла, з’єднаного з ",
    hintAfter: " або пов’язаного з ним гілкою, щоб додати чи прибрати його — усе обране згортається в нього й зникає з полотна.",
    removeTitle: "Прибрати з цього згортка",
    packN: (n) => `Згорнути ${ukNodes(n)}`,
    pickAtLeastOne: "Оберіть щонайменше 1 вузол",
    onlyLinked: "Згорнути можна лише вузли, з’єднані з контейнером або пов’язані з ним гілкою.",
  },
  link: {
    titleTwo: "З’єднати вузли",
    titleN: (n) => `З’єднати ${ukNodes(n)}`,
    sentiment: "Забарвлення",
    linking: "З’єднання…",
    createLink: "Створити зв’язок",
    createLinks: (n) => `Створити ${n} ${slavicPlural(n, "зв’язок", "зв’язки", "зв’язків")}`,
    failed: "Не вдалося створити зв’язок",
  },
  invite: {
    title: (name) => `Запросити до «${name}»`,
    loadingMembers: "Завантаження поточних учасників…",
    everyoneMember: "Усі вже є учасниками.",
    user: "Користувач",
    choose: "Оберіть користувача…",
    inviting: "Запрошення…",
    invite: "Запросити",
    invited: (username) => `${username ?? "Користувача"} запрошено.`,
    failed: "Не вдалося запросити",
    membersFailed: "Не вдалося завантажити поточних учасників",
  },
  sentiments: { neutral: "нейтральний", positive: "позитивний", negative: "негативний" },
  node: {
    byUser: (name) => `від ${name}`,
    root: "корінь",
    healthLine: (h, defeated) => `${h}/100 здоров’я${defeated ? " · переможений" : ""}`,
    pointsAt: "Націлений на",
    protects: "Захищає",
    blocked: (d, target) =>
      `Досі заблоковано ${d} шкоди — видалення цього щита повертає все ${target ? `вузлу ${target}` : "захищеному вузлу"} одразу.`,
    protectedBy: "Захищено щитом",
    title: "Назва:",
    titlePlaceholder: "Необов’язково — інакше показуються перші слова тексту",
    order: "Крок:",
    orderPlaceholder: "1, 2, 3…",
    orderTitle: "Номер кроку — пронумеруйте вузли 1, 2, 3…, щоб описати процес",
    orderBadge: (n) => `Крок ${n}`,
    type: "Тип:",
    edit: "Змінити",
    editTitle: "Відкрити вбудований редактор на полотні (текст + тип)",
    pack: "Згорнути…",
    packTitle: "Згорнути в цей вузол інші з’єднані чи пов’язані гілками вузли",
    size: "Розмір:",
    zone: "Зона:",
    zoneTitle: (z) => (z === "positive" ? "Намалювати позитивну зону лише навколо цього вузла" : "Намалювати негативну зону лише навколо цього вузла"),
    zoneRemoveTitle: "Прибрати цю зону, намальовану вручну",
    reset: "Скинути",
    symbol: "Символ:",
    symbolCheckTitle: "Примусово показати галочку незалежно від типу",
    symbolCrossTitle: "Примусово показати хрестик незалежно від типу",
    symbolResetTitle: "Використати типовий символ цього типу",
    chooseNodes: "Обрати вузли…",
    chooseNodesTitle: "Оберіть цей та інші вузли, а потім з’єднайте, скопіюйте чи видаліть їх разом",
    noLinks: "Зв’язків поки немає.",
    extractText: "Витягти текст…",
    extractTextTitle:
      "Експортувати текст кластера цього вузла — разом із кластерами, що беруть початок у його нащадках. Експорт тексту всієї мапи перенесено в меню + на панелі інструментів.",
    expand: "Розгорнути",
    collapse: "Згорнути",
    expandTitle: "Розгорнути, щоб побачити весь текст без внутрішньої прокрутки",
    collapseTitle: "Згорнути назад у поле з прокруткою",
    deleteConfirm: "Видалити цей вузол?",
    selectToSeeHealth: "Виберіть, щоб побачити здоров’я",
    circleParent: (s) => `Батько кола (${s})`,
    variantParent: (s) => `Батько варіанту (${s})`,
    zoneName: "Назва зони:",
    zoneNamePlaceholder: "Назвіть цю зону",
    clickToChangeType: "Натисніть, щоб змінити тип",
    chooseHint: "обрати?",
    ghostAgain: "натисніть ще раз, щоб додати",
  },
  attack: {
    intro: "Атака створює справжній вузол із вашим запереченням, з’єднаний з цим вузлом стрілою зброї.",
    introWeapon: " Влучання цим вузлом зцілює батька його цілі.",
    introShielded: " Цей вузол зараз під щитом — атаки будуть заблоковані.",
    objection: "Ваше заперечення",
    placeholder: "Чому це не працює?",
    as: "Як",
    writeObjection: "Напишіть заперечення вище, щоб обрати зброю.",
    writeFirst: "Спершу напишіть заперечення",
    weapons: { nitpick: "Прискіпка", counterpoint: "Контраргумент", fatalFlaw: "Фатальна вада" },
    hintNegativeTarget: "Бойовий режим: на негативний вузол ви відповідаєте позитивним (Рішення, Варіант або Успіх).",
    hintPositiveTarget: "Бойовий режим: позитивний вузол ви ставите під сумнів питанням або негативним вузлом Проблема / Проблемний варіант.",
    hintPersonal: "Творчий режим: атака лише додає вузол і не завдає шкоди.",
  },
  protect: {
    intro: "Захисний вузол повністю блокує кожну наступну атаку на цей вузол, доки його не переможено — без обмежень і без затримки.",
    why: "Чому його захищено",
    placeholder: "Чому це витримує?",
    as: "Як",
    add: "Додати захист",
    writeFirst: "Спершу напишіть, чому його захищено",
    onlyOwner: (name) => `Додати захисний вузол до цього може лише ${name}.`,
  },
  packed: { empty: "Тут нічого не згорнуто.", unpack: "Розгорнути" },
  history: { loading: "Завантаження…", none: "Атак поки немає." },
  errors: {
    clipboard: "Не вдалося скопіювати — браузер заблокував доступ до буфера обміну.",
    symbol: "Не вдалося змінити символ",
    text: "Не вдалося змінити текст",
    title: "Не вдалося змінити назву",
    order: "Не вдалося змінити номер кроку",
    numberNodes: "Не вдалося пронумерувати вибрані вузли",
    delete: "Не вдалося видалити",
    attack: "Атака не вдалася",
    protect: "Не вдалося додати захист",
    unpack: "Не вдалося розгорнути",
    size: "Не вдалося змінити розмір",
    type: "Не вдалося змінити тип",
    zone: "Не вдалося змінити зону",
    removeLink: "Не вдалося прибрати зв’язок",
    loadMap: "Не вдалося завантажити мапу",
    mapNotFound: "Мапу не знайдено",
    moveNodes: "Не вдалося перемістити вибрані вузли",
    joinCircle: "Не вдалося приєднатися до кола",
    leaveCircle: "Не вдалося вийти з кола",
    dropOnOwnBranch: "Не можна кинути вузол на його власну гілку.",
    cannotJoin: "Не можна приєднатися до цього кола.",
    pullOut: "Не можна витягти — у решти кола з’явиться кут менше 30°.",
    chooseOwn: "Обирати можна лише вузли, які створили ви.",
    update: "Не вдалося оновити",
    createNode: "Не вдалося створити вузол",
    paste: "Не вдалося вставити",
    deleteSelected: "Не вдалося видалити вибрані вузли",
    groupCircle: "Не вдалося згрупувати в коло",
    groupPartial: (grouped, total, skipped) =>
      `Згруповано ${grouped} із ${total} — пропущено: ${skipped} (замкнули б петлю).`,
    createCircle: "Не вдалося створити коло",
    releaseCircle: "Не вдалося звільнити стабілізоване коло",
    updateCircle: "Не вдалося оновити стабілізоване коло",
    changeMode: "Не вдалося змінити режим мапи",
    pack: "Не вдалося згорнути",
    loadSummary: "Не вдалося завантажити підсумок",
    loadUsers: "Не вдалося завантажити користувачів",
    action: "Дія не вдалася",
    wipe: "Не вдалося очистити",
  },
  loadingMap: "Завантаження мапи…",
  display: {
    header: "Показати вибрані вузли як",
    followMap: "Так само, як мапа",
    zoomedToFit: "Наближено, щоб вузли не перекривалися.",
    stillOverlap: "Наближено до максимуму — кілька вузлів усе ще перекриваються.",
  },
  lines: {
    toolbar: "Намалювати розділову лінію",
    hintStart: "Клацайте на вільні місця, щоб задати точки лінії. Вона не може йти через вузли чи зони, але може з’єднуватися з іншими лініями.",
    crossing: "Ця ділянка пройшла б через вузол або зону — оберіть місце, що залишить лінію вільною.",
    hintPoints: (n) => `Точок: ${n} — Enter завершує, Backspace скасовує крок, Esc очищає.`,
    blocked: "Це місце на вузлі або зоні — оберіть вільне.",
    undo: "Скасувати крок",
    finish: "Завершити лінію",
    exit: "Вийти",
    deleteTitle: "Клацніть, щоб видалити цю лінію",
    deleteConfirm: "Видалити цю лінію?",
    createFailed: "Не вдалося намалювати лінію",
    deleteFailed: "Не вдалося видалити лінію",
  },
  clipboard: {
    copyMap: "Копіювати вміст мапи",
    copied: (n) => `Скопійовано: ${ukNodes(n)}. Відкрийте мапу й вставте через Ctrl+V або + > Вставити.`,
    mapCopied: (n, mapName) => `Скопійовано з «${mapName}»: ${ukNodes(n)}. Відкрийте іншу мапу й вставте через Ctrl+V або + > Вставити.`,
    mapEmpty: (mapName) => `У мапі «${mapName}» нічого копіювати.`,
    nothingToCopy: "Нічого копіювати.",
    nothingToPaste: "Нічого вставляти — спершу скопіюйте вузли або цілу мапу.",
    pasted: (n) => `Вставлено: ${ukNodes(n)}.`,
    copyWholeMap: "Копіювати всю мапу",
    paste: (n) => `Вставити ${ukNodes(n)}`,
    pasteHere: (n) => `Вставити ${ukNodes(n)} сюди`,
    storeFailed: "Не вдалося зберегти копію — браузер заблокував сховище.",
    copyFailed: "Не вдалося скопіювати",
  },
  people: {
    membersTitle: (mapName) => `Учасники мапи «${mapName}»`,
    ownerTitle: (mapName) => `Власник мапи «${mapName}»`,
    owner: "власник",
    you: "ви",
    noMembers: "Учасників поки немає.",
    unknown: "Невідомий користувач",
  },
  demo: {
    exit: "Вийти з демо",
    exitTitle: "Вийти з демо, щоб увійти або зареєструватися",
    exitConfirm: "Вийти з демо? Ця демо-мапа тимчасова й буде втрачена.",
  },
  canvas: {
    stabilized: "Стабілізовано — клацніть на ньому або будь-де поза ним, щоб знову дозволити йому дрейфувати разом з іншими",
    stabilizeZone: "Клацніть, щоб стабілізувати цю зону й дозволити всім іншим зонам дрейфувати",
    stabilizeCircle: "Клацніть, щоб стабілізувати це коло й дозволити всім іншим колам дрейфувати",
    newCircleText: "Нове коло",
    newNodeText: "Новий вузол",
  },
  minimapTitle: "Мінімапа — клацніть або перетягніть, щоб перейти по мапі",
  panelDragHandle: "Перетягніть, щоб пересунути цю панель",
  exportText: { title: (name) => `Експорт тексту — «${name}»`, download: "Завантажити .md" },
  summary: {
    title: (name) => `Підсумок — «${name}»`,
    nodes: (n) => `${n} вузол(ів)`,
    members: (n) => `${n} учасник(ів)`,
  },
  cardMenuLabel: "Меню мапи",
  admin: {
    title: "Адміністрування",
    subtitle: "Керування всіма зареєстрованими користувачами.",
    wipe: "Очистити базу даних",
    loading: "Завантаження користувачів…",
    username: "Ім’я користувача",
    email: "Електронна пошта",
    role: "Роль",
    status: "Стан",
    admin: "адмін",
    blocked: "заблоковано",
    active: "активний",
    block: "Заблокувати",
    unblock: "Розблокувати",
    delete: "Видалити",
    deleteConfirm: (u) => `Видалити ${u}? Буде видалено кожну мапу, якою він володіє.`,
    wipeConfirm: "Очистити ВСЮ базу даних — усіх користувачів, мапи та вузли? Цю дію не можна скасувати.",
    wipeConfirmAgain: "Ви абсолютно впевнені? Підтвердження без повернення № 2.",
  },
};

const ruNodes = (n: number) => `${n} ${slavicPlural(n, "узел", "узла", "узлов")}`;
const ru: UiStrings = {
  common: {
    cancel: "Отмена",
    close: "Закрыть",
    delete: "Удалить",
    copy: "Копировать",
    copied: "Скопировано ✓",
    loading: "Загрузка…",
    reset: "Сбросить",
    edit: "Изменить",
    done: "Готово",
  },
  visibility: { hide: "Скрыть эту ветку от приглашённых", show: "Показать эту ветку приглашённым", hint: "Приглашённые участники не видят этот узел и всё, что от него отходит. Вы видите его всегда.", badge: "Скрыто от приглашённых" },
  search: { title: "Поиск узлов", placeholder: "Найти узел по названию или тексту", none: "Ничего не найдено", found: (n) => `Найдено: ${n}` },
  compact: { label: "Упрощённый вид", hint: "Меньшие иконки, без нимба и рогов и без колец — меньше визуального шума на маленьком экране" },
  types: {
    Problem: "Проблема",
    "Problematic option": "Проблемный вариант",
    Solution: "Решение (цель)",
    Option: "Вариант",
    Success: "Успех",
    Fail: "Неудача",
    unknown: "Вопрос (неизвестное)",
  },
  templates: {
    section: "Шаблоны",
    problem: { button: "Проанализировать эту проблему", hint: "Добавляет подпроблемы, риск бездействия, прошлый опыт, способы решения, план и его результат." },
    goal: { button: "Спланировать эту цель", hint: "Добавляет критерий успеха, пронумерованные шаги, препятствие с запасным планом и проверку." },
    retry: { title: "Не получилось", hint: "Выясните почему и решите, что изменить, прежде чем пробовать снова.", button: "Проанализировать и попробовать снова" },
    created: (n) => `Добавлено: ${ruNodes(n)}`,
    failed: "Не удалось добавить шаблон",
    nodes: {
      subProblem1: { title: "Подпроблема 1", text: "Какая часть проблемы не работает? (одна причина на узел)" },
      subProblem2: { title: "Подпроблема 2", text: "Что ещё к ней приводит?" },
      negativeScenario: { title: "Если ничего не делать", text: "Что худшее произойдёт, если оставить всё как есть?" },
      experiencePositive: { title: "Что сработало", text: "Что мы уже пробовали, и это помогло?" },
      experienceNegative: { title: "Что не сработало", text: "Что мы уже пробовали, и не получилось, и почему?" },
      way1: { title: "Способ решения 1", text: "Один из возможных путей решения" },
      way2: { title: "Способ решения 2", text: "Альтернативный путь решения" },
      plan: { title: "План", text: "Кто что делает и к какому сроку?" },
      resultPositive: { title: "Результат: получилось", text: "Что именно улучшилось? Как мы это определим?" },
      resultNegative: { title: "Результат: не получилось", text: "Что пошло не так? (затем проанализируйте и попробуйте снова)" },
      criteria: { title: "Критерий успеха", text: "Как мы поймём, что цель достигнута? Сделайте его измеримым." },
      step1: { title: "Шаг 1", text: "Первое конкретное действие" },
      step2: { title: "Шаг 2", text: "Следующее действие" },
      step3: { title: "Шаг 3", text: "Последнее действие перед целью" },
      obstacle: { title: "Препятствие", text: "Что может нас остановить?" },
      fallback: { title: "Запасной план", text: "Что делаем, если это случится?" },
      review: { title: "Проверка", text: "Когда проверяем прогресс и кто решает?" },
      whyFailed: { title: "Почему не получилось?", text: "Спросите «почему», а потом ещё раз «почему» — пока не дойдёте до настоящей причины." },
      tryAgain: { title: "Попробовать снова", text: "Что мы изменим на этот раз?" },
      rootProblem: { title: "Проблема", text: "В чём именно проблема и кого она касается?" },
      rootGoal: { title: "Цель", text: "Чего мы хотим достичь и к какому сроку?" },
      rootDecision: { title: "Решение", text: "Что нам нужно решить?" },
      rootRetro: { title: "Итоги", text: "На что мы оглядываемся?" },
      criteriaQuestion: { title: "Что важнее всего?", text: "Какие критерии решат — стоимость, время, риск, качество?" },
      optionA: { title: "Вариант A", text: "Один из возможных выборов" },
      advantageA: { title: "Преимущество A", text: "Что говорит в его пользу?" },
      riskA: { title: "Риск A", text: "Что может пойти не так?" },
      optionB: { title: "Вариант B", text: "Один из возможных выборов" },
      advantageB: { title: "Преимущество B", text: "Что говорит в его пользу?" },
      riskB: { title: "Риск B", text: "Что может пойти не так?" },
      optionC: { title: "Вариант C", text: "Один из возможных выборов" },
      advantageC: { title: "Преимущество C", text: "Что говорит в его пользу?" },
      riskC: { title: "Риск C", text: "Что может пойти не так?" },
      wentWell1: { title: "Что получилось", text: "То, что сработало и стоит повторить" },
      wentWell2: { title: "Ещё один успех", text: "Что ещё получилось?" },
      wentBad1: { title: "Что не получилось", text: "То, что не сработало, и почему" },
      wentBad2: { title: "Ещё одна проблема", text: "Что ещё пошло не так?" },
      tryNext1: { title: "Изменение 1", text: "Одна вещь, которую мы сделаем иначе" },
      tryNext2: { title: "Изменение 2", text: "Ещё одно изменение для проверки" },
    },
  },
  contextMenu: { createBranch: "Создать ветку", update: "Изменить", choose: "Выбрать…", delete: "Удалить", attack: "Атаковать" },
  selection: {
    tapToChoose: "Касайтесь своих узлов, чтобы выбрать их",
    finishHint: "Родитель берёт всю свою ветку (Shift+касание: только этот узел). Готово: коснитесь вне узлов или нажмите Enter.",
    chosen: (n) => `Выбрано: ${ruNodes(n)}`,
    selected: (n) => `Выделено: ${ruNodes(n)}`,
    actions: "Действия",
    link: "Связать",
    number: "Пронумеровать по порядку",
    clearNumbers: "Убрать номера",
    numberTitle: "Нумерует выбранные узлы 1, 2, 3… в порядке выбора",
    copy: "Копировать",
    copyText: "Копировать как текст",
    groupCircle: "Сгруппировать в круг",
    deleteN: (n) => `Удалить ${ruNodes(n)}`,
    deselect: "Снять выделение",
    needTwoToLink: "Выберите не менее 2 узлов, чтобы связать их",
    needTwoToGroup: "Выделите не менее 2 узлов, чтобы сгруппировать их",
    deleteConfirm: (n) => `Удалить ${ruNodes(n)}?`,
  },
  pack: {
    pickToPack: "Выберите узлы для сворачивания",
    picked: (n) => `Выбрано: ${n}`,
    hintBefore: "Коснитесь узла, связанного с ",
    hintAfter: " или соединённого с ним веткой, чтобы добавить или убрать его — всё выбранное сворачивается в него и исчезает с холста.",
    removeTitle: "Убрать из этого свёртка",
    packN: (n) => `Свернуть ${ruNodes(n)}`,
    pickAtLeastOne: "Выберите хотя бы 1 узел",
    onlyLinked: "Свернуть можно только узлы, связанные с контейнером или соединённые с ним веткой.",
  },
  link: {
    titleTwo: "Связать узлы",
    titleN: (n) => `Связать ${ruNodes(n)}`,
    sentiment: "Окраска",
    linking: "Связывание…",
    createLink: "Создать связь",
    createLinks: (n) => `Создать ${n} ${slavicPlural(n, "связь", "связи", "связей")}`,
    failed: "Не удалось создать связь",
  },
  invite: {
    title: (name) => `Пригласить в «${name}»`,
    loadingMembers: "Загрузка текущих участников…",
    everyoneMember: "Все уже являются участниками.",
    user: "Пользователь",
    choose: "Выберите пользователя…",
    inviting: "Приглашение…",
    invite: "Пригласить",
    invited: (username) => `${username ?? "Пользователь"} приглашён.`,
    failed: "Не удалось пригласить",
    membersFailed: "Не удалось загрузить текущих участников",
  },
  sentiments: { neutral: "нейтральный", positive: "позитивный", negative: "негативный" },
  node: {
    byUser: (name) => `от ${name}`,
    root: "корень",
    healthLine: (h, defeated) => `${h}/100 здоровья${defeated ? " · побеждён" : ""}`,
    pointsAt: "Нацелен на",
    protects: "Защищает",
    blocked: (d, target) =>
      `Пока заблокировано ${d} урона — удаление этого щита возвращает всё ${target ? `узлу ${target}` : "защищаемому узлу"} сразу.`,
    protectedBy: "Защищён щитом",
    title: "Название:",
    titlePlaceholder: "Необязательно — иначе показываются первые слова текста",
    order: "Шаг:",
    orderPlaceholder: "1, 2, 3…",
    orderTitle: "Номер шага — пронумеруйте узлы 1, 2, 3…, чтобы описать процесс",
    orderBadge: (n) => `Шаг ${n}`,
    type: "Тип:",
    edit: "Изменить",
    editTitle: "Открыть встроенный редактор на холсте (текст + тип)",
    pack: "Свернуть…",
    packTitle: "Свернуть в этот узел другие связанные или соединённые ветками узлы",
    size: "Размер:",
    zone: "Зона:",
    zoneTitle: (z) => (z === "positive" ? "Нарисовать позитивную зону только вокруг этого узла" : "Нарисовать негативную зону только вокруг этого узла"),
    zoneRemoveTitle: "Убрать эту зону, нарисованную вручную",
    reset: "Сбросить",
    symbol: "Символ:",
    symbolCheckTitle: "Принудительно показать галочку независимо от типа",
    symbolCrossTitle: "Принудительно показать крестик независимо от типа",
    symbolResetTitle: "Использовать символ этого типа по умолчанию",
    chooseNodes: "Выбрать узлы…",
    chooseNodesTitle: "Выберите этот и другие узлы, а затем свяжите, скопируйте или удалите их вместе",
    noLinks: "Связей пока нет.",
    extractText: "Извлечь текст…",
    extractTextTitle:
      "Экспортировать текст кластера этого узла — вместе с кластерами, берущими начало в его потомках. Экспорт текста всей карты перенесён в меню + на панели инструментов.",
    expand: "Развернуть",
    collapse: "Свернуть",
    expandTitle: "Развернуть, чтобы увидеть весь текст без внутренней прокрутки",
    collapseTitle: "Свернуть обратно в поле с прокруткой",
    deleteConfirm: "Удалить этот узел?",
    selectToSeeHealth: "Выберите, чтобы увидеть здоровье",
    circleParent: (s) => `Родитель круга (${s})`,
    variantParent: (s) => `Родитель варианта (${s})`,
    zoneName: "Название зоны:",
    zoneNamePlaceholder: "Назовите эту зону",
    clickToChangeType: "Нажмите, чтобы изменить тип",
    chooseHint: "выбрать?",
    ghostAgain: "нажмите ещё раз, чтобы добавить",
  },
  attack: {
    intro: "Атака создаёт настоящий узел с вашим возражением, связанный с этим узлом стрелой оружия.",
    introWeapon: " Попадание этим узлом лечит родителя его цели.",
    introShielded: " Этот узел сейчас под щитом — атаки будут заблокированы.",
    objection: "Ваше возражение",
    placeholder: "Почему это не работает?",
    as: "Как",
    writeObjection: "Напишите возражение выше, чтобы выбрать оружие.",
    writeFirst: "Сначала напишите возражение",
    weapons: { nitpick: "Придирка", counterpoint: "Контраргумент", fatalFlaw: "Фатальный изъян" },
    hintNegativeTarget: "Боевой режим: на негативный узел вы отвечаете позитивным (Решение, Вариант или Успех).",
    hintPositiveTarget: "Боевой режим: позитивный узел вы ставите под сомнение вопросом или негативным узлом Проблема / Проблемный вариант.",
    hintPersonal: "Творческий режим: атака лишь добавляет узел и не наносит урона.",
  },
  protect: {
    intro: "Защитный узел полностью блокирует каждую следующую атаку на этот узел, пока его не победили — без ограничений и без задержки.",
    why: "Почему он защищён",
    placeholder: "Почему это выдерживает?",
    as: "Как",
    add: "Добавить защиту",
    writeFirst: "Сначала напишите, почему он защищён",
    onlyOwner: (name) => `Добавить защитный узел к этому может только ${name}.`,
  },
  packed: { empty: "Здесь ничего не свёрнуто.", unpack: "Развернуть" },
  history: { loading: "Загрузка…", none: "Атак пока нет." },
  errors: {
    clipboard: "Не удалось скопировать — браузер заблокировал доступ к буферу обмена.",
    symbol: "Не удалось изменить символ",
    text: "Не удалось изменить текст",
    title: "Не удалось изменить название",
    order: "Не удалось изменить номер шага",
    numberNodes: "Не удалось пронумеровать выбранные узлы",
    delete: "Не удалось удалить",
    attack: "Атака не удалась",
    protect: "Не удалось добавить защиту",
    unpack: "Не удалось развернуть",
    size: "Не удалось изменить размер",
    type: "Не удалось изменить тип",
    zone: "Не удалось изменить зону",
    removeLink: "Не удалось убрать связь",
    loadMap: "Не удалось загрузить карту",
    mapNotFound: "Карта не найдена",
    moveNodes: "Не удалось переместить выбранные узлы",
    joinCircle: "Не удалось присоединиться к кругу",
    leaveCircle: "Не удалось выйти из круга",
    dropOnOwnBranch: "Нельзя бросить узел на его собственную ветку.",
    cannotJoin: "Нельзя присоединиться к этому кругу.",
    pullOut: "Нельзя вытащить — у оставшегося круга появится угол меньше 30°.",
    chooseOwn: "Выбирать можно только узлы, созданные вами.",
    update: "Не удалось обновить",
    createNode: "Не удалось создать узел",
    paste: "Не удалось вставить",
    deleteSelected: "Не удалось удалить выбранные узлы",
    groupCircle: "Не удалось сгруппировать в круг",
    groupPartial: (grouped, total, skipped) =>
      `Сгруппировано ${grouped} из ${total} — пропущено: ${skipped} (замкнули бы петлю).`,
    createCircle: "Не удалось создать круг",
    releaseCircle: "Не удалось освободить стабилизированный круг",
    updateCircle: "Не удалось обновить стабилизированный круг",
    changeMode: "Не удалось изменить режим карты",
    pack: "Не удалось свернуть",
    loadSummary: "Не удалось загрузить сводку",
    loadUsers: "Не удалось загрузить пользователей",
    action: "Действие не удалось",
    wipe: "Не удалось очистить",
  },
  loadingMap: "Загрузка карты…",
  display: {
    header: "Показать выбранные узлы как",
    followMap: "Так же, как карта",
    zoomedToFit: "Приближено, чтобы узлы не перекрывались.",
    stillOverlap: "Приближено до максимума — несколько узлов всё ещё перекрываются.",
  },
  lines: {
    toolbar: "Нарисовать разделительную линию",
    hintStart: "Щёлкайте по свободным местам, чтобы задать точки линии. Она не может проходить через узлы и зоны, но может соединяться с другими линиями.",
    crossing: "Этот участок прошёл бы через узел или зону — выберите место, которое оставит линию свободной.",
    hintPoints: (n) => `Точек: ${n} — Enter завершает, Backspace отменяет шаг, Esc очищает.`,
    blocked: "Это место занято узлом или зоной — выберите свободное.",
    undo: "Отменить шаг",
    finish: "Завершить линию",
    exit: "Выйти",
    deleteTitle: "Щёлкните, чтобы удалить эту линию",
    deleteConfirm: "Удалить эту линию?",
    createFailed: "Не удалось нарисовать линию",
    deleteFailed: "Не удалось удалить линию",
  },
  clipboard: {
    copyMap: "Копировать содержимое карты",
    copied: (n) => `Скопировано: ${ruNodes(n)}. Откройте карту и вставьте через Ctrl+V или + > Вставить.`,
    mapCopied: (n, mapName) => `Скопировано из «${mapName}»: ${ruNodes(n)}. Откройте другую карту и вставьте через Ctrl+V или + > Вставить.`,
    mapEmpty: (mapName) => `В карте «${mapName}» нечего копировать.`,
    nothingToCopy: "Нечего копировать.",
    nothingToPaste: "Нечего вставлять — сначала скопируйте узлы или всю карту.",
    pasted: (n) => `Вставлено: ${ruNodes(n)}.`,
    copyWholeMap: "Копировать всю карту",
    paste: (n) => `Вставить ${ruNodes(n)}`,
    pasteHere: (n) => `Вставить ${ruNodes(n)} сюда`,
    storeFailed: "Не удалось сохранить копию — браузер заблокировал хранилище.",
    copyFailed: "Не удалось скопировать",
  },
  people: {
    membersTitle: (mapName) => `Участники карты «${mapName}»`,
    ownerTitle: (mapName) => `Владелец карты «${mapName}»`,
    owner: "владелец",
    you: "вы",
    noMembers: "Участников пока нет.",
    unknown: "Неизвестный пользователь",
  },
  demo: {
    exit: "Выйти из демо",
    exitTitle: "Выйти из демо, чтобы войти или зарегистрироваться",
    exitConfirm: "Выйти из демо? Эта демо-карта временная и будет потеряна.",
  },
  canvas: {
    stabilized: "Стабилизировано — щёлкните по нему или в любом месте вне него, чтобы снова позволить ему дрейфовать вместе с остальными",
    stabilizeZone: "Щёлкните, чтобы стабилизировать эту зону и позволить всем остальным зонам дрейфовать",
    stabilizeCircle: "Щёлкните, чтобы стабилизировать этот круг и позволить всем остальным кругам дрейфовать",
    newCircleText: "Новый круг",
    newNodeText: "Новый узел",
  },
  minimapTitle: "Миникарта — щёлкните или перетащите, чтобы перейти по карте",
  panelDragHandle: "Перетащите, чтобы передвинуть эту панель",
  exportText: { title: (name) => `Экспорт текста — «${name}»`, download: "Скачать .md" },
  summary: {
    title: (name) => `Сводка — «${name}»`,
    nodes: (n) => `${n} узел(узлов)`,
    members: (n) => `${n} участник(ов)`,
  },
  cardMenuLabel: "Меню карты",
  admin: {
    title: "Администрирование",
    subtitle: "Управление всеми зарегистрированными пользователями.",
    wipe: "Очистить базу данных",
    loading: "Загрузка пользователей…",
    username: "Имя пользователя",
    email: "Электронная почта",
    role: "Роль",
    status: "Статус",
    admin: "админ",
    blocked: "заблокирован",
    active: "активен",
    block: "Заблокировать",
    unblock: "Разблокировать",
    delete: "Удалить",
    deleteConfirm: (u) => `Удалить ${u}? Будут удалены все карты, которыми он владеет.`,
    wipeConfirm: "Очистить ВСЮ базу данных — всех пользователей, карты и узлы? Это действие нельзя отменить.",
    wipeConfirmAgain: "Вы абсолютно уверены? Подтверждение без возврата № 2.",
  },
};

export const UI_STRINGS: Record<Language, UiStrings> = { en, cs, uk, ru };
