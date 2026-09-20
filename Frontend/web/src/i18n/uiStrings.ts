import type { Language } from "./translations";

// The rest of the app's user-facing text — panels, menus, modals, and the
// messages shown when something goes wrong. translations.ts keeps the core
// chrome (auth, dashboard, toolbar, tab labels); this covers the deeper copy.
// Same rules as there: interpolated strings are plain functions, so every
// language is checked against the exact same shape by TypeScript itself.
//
// Not translated on purpose: node type names (Problem, Option, … — stored
// values shown as-is everywhere), a server's own error text (shown as
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
  contextMenu: { createBranch: "Create branch", update: "Update", choose: "Choose…", delete: "Delete", attack: "Attack" },
  selection: {
    tapToChoose: "Tap your nodes to choose them",
    finishHint: "Tap outside or press Enter when done",
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
  contextMenu: { createBranch: "Vytvořit větev", update: "Upravit", choose: "Vybrat…", delete: "Smazat", attack: "Napadnout" },
  selection: {
    tapToChoose: "Klepnutím na své uzly je vyberete",
    finishHint: "Hotovo: klepněte mimo nebo stiskněte Enter",
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
  contextMenu: { createBranch: "Створити гілку", update: "Змінити", choose: "Обрати…", delete: "Видалити", attack: "Атакувати" },
  selection: {
    tapToChoose: "Торкайтеся своїх вузлів, щоб обрати їх",
    finishHint: "Готово: торкніться поза вузлами або натисніть Enter",
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
  contextMenu: { createBranch: "Создать ветку", update: "Изменить", choose: "Выбрать…", delete: "Удалить", attack: "Атаковать" },
  selection: {
    tapToChoose: "Касайтесь своих узлов, чтобы выбрать их",
    finishHint: "Готово: коснитесь вне узлов или нажмите Enter",
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
