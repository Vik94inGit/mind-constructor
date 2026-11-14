import type { Language } from "./translations";
import type { MapKind, NodeType } from "../types";
import type { TemplateNodeKey } from "../utils/templates";
import type { PictureTemplate } from "../utils/pictureTemplates";
import type { PictureKind } from "../utils/pictures";
import { THINK_STRINGS } from "./thinkStrings";
import type { ThinkStrings } from "./thinkStrings";
import { SIEGE_STRINGS } from "./siegeStrings";
import type { SiegeStrings } from "./siegeStrings";
import { FEELING_STRINGS } from "./feelingStrings";
import type { FeelingStrings } from "./feelingStrings";

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
    /** A confirm dialog's yes button. */
    ok: string;
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
  search: { title: string; placeholder: string; none: string; found: (count: number) => string; byType: string; clearTypes: string; filtered: (count: number) => string };
  compact: { label: string; hint: string };
  types: Record<NodeType, string>;
  /** The toolbar's 🗑 list of what was deleted on this map since it was opened (map/DeletedMenu.tsx). */
  deleted: {
    button: (count: number) => string;
    hint: string;
    restore: string;
    untitled: string;
    more: (count: number) => string;
  };
  templates: {
    section: string;
    problem: { button: string; hint: string };
    goal: { button: string; hint: string };
    retry: { title: string; hint: string; button: string };
    idea: { button: string; hint: string };
    created: (count: number) => string;
    failed: string;
    /** The notice's button that takes a template or picture back in one step. */
    undo: string;
    /** A map that just opened with its starter questions (a new map of a kind). */
    seeded: string;
    /** A leveled template's ghost that can't be written in yet (utils/templateLevels.ts): the level to answer first and how many of its questions are left. */
    locked: (level: number, left: number) => string;
    nodes: Record<TemplateNodeKey, string>;
  };
  /** Right-click on empty canvas — see map/CanvasContextMenu.tsx. */
  canvasMenu: { newNode: string; structures: Record<MapKind, string> };
  /** "Draw a picture" — see utils/pictures.ts, map/PicturePicker.tsx and map/PictureLayer.tsx. */
  pictures: {
    /** The menu item that opens the picker. */
    entry: string;
    title: string;
    hint: string;
    /** The picker's two groups: one picture per node type, and pictures just for fun. */
    forTypes: string;
    forTypesHint: string;
    forFun: string;
    names: Record<PictureKind, string>;
    /** One question per dot of the picture, in dot order, each its ghost's prompt (the first is also the picker's hint). */
    questions: Record<PictureKind, string[]>;
    /** Under a picture on the canvas: how much of it is drawn. */
    progress: (name: string, percent: number) => string;
    done: (name: string) => string;
    /** The minimap's corner badge. */
    minimap: (percent: number) => string;
    failed: string;
    /** The bar a tap on a picture's caption opens (hooks/usePictureEdit.ts). */
    edit: { open: string; bar: string; bigger: string; smaller: string; move: string; close: string; color: string; resizeFailed: string };
    /** A dot's node panel (map/nodePanel/PictureDots.tsx): the picture's dots on top, its other dots in a list under the text. */
    panel: { map: (name: string) => string; rest: string; dot: (n: number) => string; open: (label: string) => string };
  };
  contextMenu: {
    createBranch: string;
    edit: string;
    changeType: string;
    back: string;
    choose: string;
    delete: string;
    attack: string;
    /** "Remove links ›": the node's links, each with its own remove row. */
    unlink: string;
    unlinkFromParent: (name: string) => string;
    unlinkChild: (name: string) => string;
    unlinkEdge: (name: string) => string;
    unlinkAll: string;
    /** "Zones ›": how this parent's branch draws its zones (utils/zoneLayout.ts). */
    zones: string;
  };
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
    dragToConnect: string;
    titleN: (count: number) => string;
    sentiment: string;
    linking: string;
    createLink: string;
    createLinks: (count: number) => string;
    failed: string;
  };
  invite: {
    title: (mapName: string) => string;
    search: string;
    placeholder: string;
    typeMore: string;
    searching: string;
    noResults: string;
    searchFailed: string;
    inviting: string;
    invite: string;
    invited: (username: string | null) => string;
    failed: string;
    /** The live notice an invited user gets on whatever page they have open. */
    notice: (invitedBy: string, mapName: string) => string;
    open: string;
    dismiss: string;
  };
  /** Picking your own username — offered once after a first Google sign-in, and from the navbar any time. */
  username: {
    title: string;
    intro: string;
    label: string;
    hint: string;
    save: string;
    saving: string;
    keep: string;
    failed: string;
    change: string;
  };
  sentiments: { neutral: string; positive: string; negative: string };
  node: {
    byUser: (name: string) => string;
    /** The panel's buttons that read the previous / next node (← / → on the keyboard too). */
    prevNode: string;
    /** Screen-reader names: the panel's text field, and its row of tabs. */
    textLabel: string;
    /** Over the live preview of the formulas typed or pasted into a node's text ($…$, \\(…\\), $$…$$). */
    formulaPreview: string;
    tabsLabel: string;
    nextNode: string;
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
    edit: string;
    editTitle: string;
    /** Info tab: the Edit button once the text has changed — saves it. */
    saveText: string;
    saveTextTitle: string;
    pack: string;
    packTitle: string;
    size: string;
    shape: string;
    shapes: { circle: string; square: string; triangle: string };
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
    /** Shown after deleting a node — undo brings it back. */
    deletedUndo: string;
    selectToSeeHealth: string;
    circleParent: (sentiment: string) => string;
    variantParent: (sentiment: string) => string;
    zoneName: string;
    zoneNamePlaceholder: string;
    clickToChangeType: string;
    chooseHint: string;
    ghostAgain: string;
    /** On a type ghost: drag it out to drop an empty node there, written later. */
    ghostDrag: string;
    /** Starter phrases a ghost offers once it's picked out — click one to open the new node with it. */
    ghostTemplates: Record<NodeType, string[]>;
    ghostTemplatesTitle: string;
    /** On a picked ghost: turn the chosen node itself into this type. */
    ghostChangeTo: (type: string) => string;
    /** On a picked ghost: add a new node of this type. */
    ghostNewOne: (type: string) => string;
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
    shape: string;
    type: string;
    zone: string;
    removeLink: string;
    loadMap: string;
    mapNotFound: string;
    moveNodes: string;
    restoreNode: string;
    joinCircle: string;
    leaveCircle: string;
    dropOnOwnBranch: string;
    changeParent: string;
    parentNotOwn: string;
    attackParent: string;
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
  display: { header: string; followMap: string; zoomedToFit: string; stillOverlap: string; cardColor: string; cardColorReset: string; resizeCard: string; cardText: string; cardShape: string; cardShapeRounded: string; cardShapeSquare: string; cardShapeRound: string; cardFitText: string; cardLookFailed: string; dots: string; zoneView: (zone: string) => string; lockBlock: string; unlockBlock: string; blockLocked: string; magnet: string; magnetHint: string; magnetNone: string; detachPiece: string; takePuzzleApart: string; attachPiece: string; zonesInView: string; mapZones: string; zoneLayoutZones: string; zoneLayoutNested: string; zoneLayoutNone: string };
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
  /** Sorting the Inbox's quick notes into maps (utils/inbox.ts, dashboard/InboxTray.tsx, dashboard/MoveNoteModal.tsx). */
  inbox: {
    unsorted: (count: number) => string;
    sort: string;
    hide: string;
    open: string;
    loading: string;
    loadError: string;
    moveToMap: string;
    moveTitle: string;
    noTargets: string;
    moving: string;
    moved: (mapName: string) => string;
    openMap: (mapName: string) => string;
    moveError: string;
    cancel: string;
    untitled: string;
  };
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
    swapWithParent: string;
    swapWithParentHint: string;
    changeParent: string;
    changeParentHint: string;
    reparentPick: (name: string) => string;
    reparentHint: string;
    reparentSame: string;
    hideGhosts: string;
    showGhosts: string;
    takeParentPlace: string;
  };
  minimapTitle: string;
  /** The cards view kept to what fits the screen (utils/cardFit.ts). */
  cardFit: {
    packed: string;
    topIdeas: string;
    zone: (number: string) => string;
    back: string;
    next: string;
    showAll: string;
    tooMany: (extra: number) => string;
    moveExtra: (extra: number) => string;
    moveTitle: (extra: number) => string;
    newMap: string;
    newMapName: (mapName: string) => string;
    moved: (extra: number, mapName: string) => string;
  };
  /** Auto-pack (utils/autoPack.ts), the three views (utils/viewPrompt.ts) and the cards view's packing (utils/cardPack.ts). */
  autoPack: {
    pack: string;
    unpack: string;
    hint: string;
    open: (n: number) => string;
    views: { map: string; overview: string; cards: string };
    viewHints: { map: string; overview: string; cards: string };
    viewLabel: string;
    layClose: string;
    layCloseHint: string;
    packAll: string;
    unpackAll: string;
    packAllHint: string;
    unpackAllHint: string;
    promptTitle: string;
    promptClose: string;
  };
  abstraction: {
    title: string;
    label: string;
    all: string;
    level: (n: number, total: number) => string;
    hidden: (n: number) => string;
    lessDetail: string;
    moreDetail: string;
    view: string;
    moreText: string;
    lessText: string;
    minimap: string;
    menu: string;
    simpler: string;
    richer: string;
    levels: string;
    fineTune: string;
  };
  /** A zone's own pattern and colour (map/ZoneStylePicker.tsx). */
  zoneStyle: {
    pattern: string;
    color: string;
    none: string;
    auto: string;
    autoHint: string;
    /** A colour another member's zone already wears. */
    takenBy: (name: string) => string;
    edge: string;
    /** Heading over a zone's views in its menu (map/ZoneMenuBody.tsx). */
    view: string;
    patterns: Record<"dots" | "stripes" | "grid" | "chess", string>;
    colors: Record<"sand" | "sage" | "sky" | "lavender" | "rose" | "slate", string>;
  };
  /** The display menu's slider for how strongly quiet nodes fade (utils/nodeFade.ts). */
  nodeFade: { label: string; off: string; full: string };
  /** The map's canvas (Map.background), picked in the display menu by the map's owner. */
  mapBackground: {
    title: string;
    options: Record<"dots" | "plain" | "lined" | "dark", string>;
    /** The owner's own wallpaper (Map.backgroundImage). */
    picture: string;
    changePicture: string;
    removePicture: string;
    pictureFailed: string;
    /** The wallpaper's darker–lighter slider (Map.backgroundShade). */
    shade: string;
    darker: string;
    lighter: string;
    /** Choosing the part of the picture to keep (map/PictureCropDialog.tsx). */
    choosePart: string;
    cropTitle: string;
    cropHint: string;
    cropFrame: string;
    cropCancel: string;
    cropWhole: string;
    cropUse: string;
  };
  /** The one-time tip on a map with its main gestures (map/GestureHint.tsx). */
  gestureHint: { title: string; touch: string[]; mouse: string[]; gotIt: string };
  panelDragHandle: string;
  panelResizeHandle: string;
  /** Pasted text past a node's 1000 characters, offered for new nodes (components/TextOverflowOffer.tsx). */
  textOverflow: {
    message: (extra: number, max: number) => string;
    carry: (nodes: number) => string;
    leave: string;
    willCarry: (nodes: number) => string;
    undo: string;
    carried: (nodes: number) => string;
    failed: string;
  };
  /** The panel a new node is written in before it exists — map/NewNodePanel.tsx. */
  newNode: {
    title: string;
    placeholder: string;
    create: string;
    hint: string;
    /** "Ghost" checkbox: what's written becomes the node's prompt, to be filled in later. */
    ghost: string;
    ghostHint: string;
    ghostPlaceholder: string;
    createGhost: string;
  };
  /** Quiz me (map/QuizOverlay.tsx, utils/quiz.ts): the map asks, the reader answers in their head and marks it. */
  quiz: {
    /** The layers menu and the empty-canvas menu row that starts it. */
    entry: string;
    exit: string;
    count: (current: number, total: number) => string;
    showAnswer: string;
    /** Under the question while the card is still hidden. */
    hint: string;
    /** The optional field under the card where the reader writes a guess before turning it. */
    guessPlaceholder: string;
    /** Headings of the two columns once a card with a written guess is turned. */
    yourGuess: string;
    trueAnswer: string;
    notYet: string;
    shaky: string;
    know: string;
    back: string;
    roundDone: string;
    /** "Know it 11 · Shaky 4 · Not yet 3". */
    tally: (know: number, shaky: number, notYet: number) => string;
    again: string;
    restart: string;
    done: string;
    /** The map has no card to ask: no parent with children, no title with a text. */
    empty: string;
  };
  presentation: {
    exit: string;
    prev: string;
    next: string;
    slideCount: (current: number, total: number) => string;
    /** Above a child's slide: the parent it hangs from. */
    under: (parent: string) => string;
    /** On a slide's parent and each child: closes the presentation and opens that node on the map. */
    showOnMap: string;
    empty: string;
    /** A zone's menu: starts a presentation of only that zone, its castles included. */
    presentZone: string;
    /** The two tabs at the top: step through slides, or see the whole map gathered up. */
    slidesTab: string;
    summaryTab: string;
    /** The type chips: label of the row, and the chip that clears them. */
    filterTypes: string;
    allTypes: string;
    /** No node is of the picked types. */
    noMatch: string;
    /** A template map's summary: each question with its answer, by level. */
    answersTitle: string;
    level: (n: number) => string;
    /** The group of a template's root and questions without a level. */
    questions: string;
    answeredOf: (answered: number, total: number) => string;
    notAnswered: string;
    /** A level whose level before it isn't filled in yet. */
    locked: (previous: number) => string;
    /** Nodes in a template map that aren't one of its questions. */
    otherNotes: string;
    /** Any map's summary: its nodes grouped by type. */
    byTypeTitle: string;
  };
  exportText: { title: (mapName: string) => string; download: string };
  summary: { title: (mapName: string) => string; nodes: (count: number) => string; members: (count: number) => string };
  cardMenuLabel: string;
  /** The "Think it through" flow — see thinkStrings.ts. */
  think: ThinkStrings;
  /** The opponent's turn in discussion mode — see siegeStrings.ts. */
  siege: SiegeStrings;
  /** Feelings on thoughts and the before/after check-in — see feelingStrings.ts. */
  feelings: FeelingStrings;
  /** The offline / syncing indicator — see components/OfflineBanner.tsx. */
  offline: {
    offline: string;
    offlinePending: (count: number) => string;
    pending: (count: number) => string;
    syncing: (count: number) => string;
    synced: string;
    syncNow: string;
    signIn: (count: number) => string;
    failed: (count: number, error: string) => string;
    dismiss: string;
  };
  /** Pictures on a node — see map/nodePanel/ImagesSection.tsx. */
  images: {
    title: string;
    add: string;
    hint: string;
    remove: string;
    open: string;
    close: string;
    /** The picture viewer's buttons for the previous / next picture. */
    prev: string;
    next: string;
    loading: string;
    limit: (max: number) => string;
    tooLarge: string;
    failed: string;
    selectNode: string;
    /** On a picture: show it as the node's icon (NodeDoc.iconImage). */
    useAsIcon: string;
    isIcon: string;
    removeIcon: string;
    /** On a picture: show it as a card on the map (NodeDoc.cardImage). */
    useAsCard: string;
    isCard: string;
    removeCard: string;
    iconFailed: string;
    /** The button that opens the ready-made pictures, one per node type (utils/pictureTemplates.ts). */
    templates: string;
    templatesHint: string;
    /** Each ready-made painting's name (utils/pictureTemplates.ts), read out and shown on hover. */
    templateNames: Record<PictureTemplate, string>;
    /** A template's painting couldn't be fetched (offline). */
    templateFailed: string;
  };
  /** A node's emoji, and the "emoji first" view — see map/NodeFlipIcon.tsx. */
  emoji: {
    label: string;
    current: string;
    remove: string;
    customPlaceholder: string;
    use: string;
    invalid: string;
    failed: string;
    first: string;
    firstHint: string;
    /** The eye menu's per-type emoji (utils/typeEmoji.ts). */
    typeEmoji: string;
    typeEmojiHint: string;
    typeSymbol: string;
    typeEmojiReset: string;
    /** Node.emojiStill, in the Modify tab. */
    still: string;
    stillHint: string;
    /** Above the emoji ghost ring (map/QuickAddGhosts.tsx). */
    ringPrompt: string;
    /** The ring's "no emoji" ghost. */
    skip: string;
    /** Names of QuickAddGhosts' FEELING_EMOJIS, same order. */
    feelings: string[];
  };
  /** "Text → nodes" right on the map — see map/TextToNodesModal.tsx. */
  textNodes: {
    entry: string;
    title: string;
    hint: string;
    withRoot: string;
    /** The main node can hang from a node already on the map. */
    rootHangsFrom: string;
    next: string;
    back: string;
    markHint: string;
    splitLines: string;
    splitSentences: string;
    add: (count: number) => string;
    adding: (done: number, total: number) => string;
    nothing: string;
    noRoom: string;
    overflowTitle: string;
    overflow: (fit: number, total: number) => string;
    packHint: (need: number) => string;
    packNeedsRoot: string;
    useRoot: string;
    picked: (picked: number, need: number) => string;
    addAndPack: (shown: number, packed: number) => string;
    created: (count: number, packed: number) => string;
    failed: string;
    /** Splitting a node already on the map (node panel → Modify, or its menu). */
    splitEntry: string;
    splitEntryTitle: string;
    splitTitle: string;
    splitHint: string;
    thisNode: string;
    takeOut: string;
    keeps: (text: string) => string;
    keepsAll: string;
    nothingLeft: string;
  };
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
    /** The usage numbers above the user list (admin/UsageSummary.tsx). */
    usage: {
      title: string;
      hint: string;
      days: (n: number) => string;
      includeDemo: string;
      /** This browser asks not to be tracked, so nothing done in it is counted. */
      optedOut: string;
      loading: string;
      failed: string;
      today: string;
      week: string;
      month: string;
      returning: string;
      users: string;
      newUsers: string;
      maps: string;
      nodes: string;
      dailyTitle: string;
      dayTip: (day: string, users: number, events: number) => string;
      event: string;
      times: string;
      people: string;
      none: string;
      /** A readable name per event; an unknown one shows as sent. */
      events: Record<string, string>;
      featuresTitle: string;
      featuresHint: string;
      feature: string;
      neverUsed: string;
      /** A readable name per feature in utils/usage.ts FEATURES. */
      features: Record<string, string>;
    };
  };
}

const en: UiStrings = {
  common: {
    cancel: "Cancel",
    ok: "OK",
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
  search: { title: "Search nodes", placeholder: "Find a node by its title or text", none: "Nothing found", found: (n) => `${n} found`, byType: "Show only", clearTypes: "All types", filtered: (n) => `Showing ${n} ${n === 1 ? "type" : "types"}` },
  compact: { label: "Simplified view", hint: "Smaller icons, no halo or horns, no circle rings — less clutter on a small screen" },
  types: {
    Problem: "Problem",
    "Problematic option": "Problematic option",
    Solution: "Solution (goal)",
    Option: "Option",
    Success: "Success",
    Fail: "Fail",
    Idea: "Idea",
    unknown: "Question (unknown)",
  },
  deleted: {
    button: (n) => `Deleted on this map: ${n}`,
    hint: "Deleted since you opened this map. They stay here until you close it.",
    restore: "Restore",
    untitled: "(empty)",
    more: (n) => `+${n} more`,
  },
  templates: {
    section: "Templates",
    problem: { button: "Analyze this problem", hint: "Adds sub-problems, the risk of doing nothing, past experience, ways to solve, a plan and its result." },
    goal: { button: "Plan this goal", hint: "Adds a success criterion, ordered steps, an obstacle with a fallback, and a review." },
    retry: { title: "This did not work out", hint: "Find out why, then choose what to change before trying again.", button: "Analyze and try again" },
    idea: { button: "Develop this idea", hint: "Asks in three rounds: the idea itself, then how to make it happen, then how it went. Each round opens once the one before is answered." },
    created: (n) => `Added ${n} ${n === 1 ? "node" : "nodes"}`,
    failed: "Could not add the template",
    undo: "Undo",
    seeded: "Started with the template questions",
    locked: (level, left) => `🔒 Answer level ${level} first (${left} left). Delete a question you want to skip.`,
    nodes: {
      subProblem1: "Which part of the problem is broken? (one cause per node)",
      subProblem2: "What else contributes to it?",
      negativeScenario: "What is the worst that happens if this is left as it is?",
      experiencePositive: "What have we already tried that helped?",
      experienceNegative: "What have we already tried that failed, and why?",
      way1: "One possible way to solve it",
      way2: "An alternative way to solve it",
      plan: "Who does what, and by when?",
      resultPositive: "What exactly improved? How do we know?",
      resultNegative: "What went wrong? (then analyze and try again)",
      criteria: "How will we know the goal is reached? Make it measurable.",
      step1: "The first concrete action",
      step2: "The next action",
      step3: "The last action before the goal",
      obstacle: "What could stop us?",
      fallback: "What do we do if that happens?",
      review: "When do we check progress, and who decides?",
      whyFailed: "Ask why, then ask why again — until you reach the real cause.",
      tryAgain: "What will we change this time?",
      rootProblem: "What exactly is the problem, and who does it affect?",
      rootGoal: "What do we want to achieve, and by when?",
      rootDecision: "What do we have to decide?",
      rootRetro: "What are we looking back at?",
      criteriaQuestion: "Which criteria will decide it — cost, time, risk, quality?",
      optionA: "One possible choice",
      advantageA: "What speaks for it?",
      riskA: "What could go wrong with it?",
      optionB: "One possible choice",
      advantageB: "What speaks for it?",
      riskB: "What could go wrong with it?",
      optionC: "One possible choice",
      advantageC: "What speaks for it?",
      riskC: "What could go wrong with it?",
      wentWell1: "Something that worked and is worth repeating",
      wentWell2: "What else went well?",
      wentBad1: "Something that did not work, and why",
      wentBad2: "What else went wrong?",
      tryNext1: "One thing we will do differently",
      tryNext2: "Another change to try",
      rootIdea: "Name the idea in a few words",
      ideaWhat: "What is the idea?",
      ideaFeel: "What do you feel about it?",
      ideaSolves: "What problem does it solve?",
      ideaWhyWork: "Why would it work?",
      ideaProfit: "What is the profit?",
      ideaPossibilities: "What are the possibilities?",
      ideaObstacles: "What are the problems and obstacles?",
      ideaPlan: "What is the plan?",
      ideaFeelPlan: "What do you feel now?",
      ideaSucceeded: "What was done successfully?",
      ideaFailed: "What failed?",
      ideaBrings: "What does it bring to the table?",
      ideaFeelDone: "What do you feel about it?",
      ideaFinished: "Is it finished as it is?",
    },
  },
  canvasMenu: {
    newNode: "New node",
    structures: { problem: "Analyze a problem", goal: "Plan a goal", decision: "Make a decision", retro: "Look back (retrospective)", idea: "Develop an idea" },
  },
  pictures: {
    entry: "Draw a picture…",
    title: "Draw a picture",
    hint: "Its dots arrive as empty thoughts. Write in two neighbours and the line between them draws itself, until the whole picture is there.",
    forTypes: "For a kind of thought",
    forTypesHint: "Each one's dots arrive as thoughts of that kind.",
    forFun: "Just for fun",
    names: { bulb: "Bulb", stop: "Stop sign", warning: "Warning", key: "Key", fork: "Crossroads", flag: "Flag", cloud: "Rain cloud", question: "Question mark", heart: "Heart", star: "Star", house: "House", tree: "Tree", fish: "Fish", smile: "Smile" },
    questions: {
      bulb: ["What idea lights up?", "What could you try that you haven't yet?", "What would make it easier?", "What would you do if you couldn't fail?", "What would a child suggest?", "What could you combine?", "What could you do differently tomorrow?", "What idea have you been putting off?", "What would make it fun?", "What is the simplest way?"],
      stop: ["What is stopping you?", "What keeps coming back?", "What worries you most about it?", "What is it costing you?", "What are you avoiding?", "What is out of your hands?", "What drains your energy?", "What would happen if you did nothing?"],
      warning: ["What could go wrong here?", "What is the catch?", "What would you have to give up?", "What makes you hesitate?", "What are you ignoring?", "Who might not like it?", "What could it cost later?", "What is the worst that could happen?"],
      key: ["What could unlock it?", "What has worked before?", "Who could help you with it?", "What is the smallest step that would help?", "What do you already have?", "What would you advise a friend?", "What could you stop doing?", "What could you ask for?", "What would make it easy to start?", "What will you do first?"],
      fork: ["Which way could you go?", "What else could you choose?", "What if you did the opposite?", "What would someone you admire choose?", "What would you choose without fear?", "What can you try first?"],
      flag: ["What have you already managed?", "What are you proud of?", "What went better than you expected?", "What did you learn on the way?", "Who helped you get here?", "What got easier?", "How will you celebrate?"],
      cloud: ["What didn't work out?", "What would you do differently?", "What did it teach you?", "What still hurts about it?", "What was out of your control?", "What would you tell yourself back then?", "What can you let go of?", "What came out of it after all?", "Who could you talk to about it?", "What will you try next time?"],
      question: ["What are you not sure about yet?", "What do you still need to find out?", "What are you guessing?", "Who could you ask?", "What would help you decide?", "What are you afraid to ask?", "How could you test it?"],
      heart: ["What do you love?", "Who do you love?", "What warms you up?", "What would you never give up?", "What makes you feel alive?", "Who do you miss?", "What do you love about yourself?", "What place do you love?", "What do you love to do?", "Who loves you?"],
      star: ["What do you want to reach?", "What would make you proud?", "What do you dream about?", "Where do you want to be in a year?", "What would you like to learn?", "Who do you want to become?", "What would you try if no one watched?", "What is your next big step?", "What would make this year special?", "What wish do you keep to yourself?"],
      house: ["What makes you feel at home?", "Who makes you feel safe?", "Where do you rest best?", "What would you keep forever?", "What smell reminds you of home?", "Who would you invite over?", "What makes a room cosy for you?", "What do you need to feel calm?", "What does home mean to you?"],
      tree: ["What helps you grow?", "What are your roots?", "What gives you strength?", "What would you like to learn?", "What have you outgrown?", "Who has helped you grow?", "What is starting to blossom?"],
      fish: ["Where would you like to go?", "What would you like to explore?", "What carries you along?", "What would you like to leave behind?", "What makes you feel free?", "What new thing would you dive into?", "Who would you take with you?", "What are you swimming against?"],
      smile: ["What made you smile lately?", "Who makes you laugh?", "What are you grateful for?", "What small thing made your day?", "What funny moment do you remember?", "What are you looking forward to?", "What made you laugh as a child?", "Who could you make smile today?", "What kind thing did someone do for you?", "What song cheers you up?", "What did you do well today?", "What makes you laugh at yourself?", "What is good right now?"],
    },
    progress: (name, percent) => `${name} · ${percent}% drawn`,
    done: (name) => `${name} · done!`,
    minimap: (percent) => `Pictures ${percent}% drawn`,
    failed: "Couldn't draw the picture.",
    panel: {
      map: (name) => `${name}: its dots, this one marked`,
      rest: "The rest of the picture",
      dot: (n) => `Dot ${n}`,
      open: (label) => `Open ${label}`,
    },
    edit: {
      open: "Tap to resize it, colour it or move it",
      bar: "Picture size and place",
      bigger: "Bigger",
      smaller: "Smaller",
      move: "Move",
      close: "Done",
      color: "Background colour",
      resizeFailed: "Couldn't resize the picture.",
    },
  },
  contextMenu: {
    createBranch: "Create branch",
    edit: "Edit",
    changeType: "Change type",
    back: "Back",
    choose: "Choose…",
    delete: "Delete",
    attack: "Attack",
    unlink: "Remove links",
    unlinkFromParent: (n) => `Unhook from “${n}”`,
    unlinkChild: (n) => `Unhook child “${n}”`,
    unlinkEdge: (n) => `Remove link with “${n}”`,
    unlinkAll: "Remove all links",
    zones: "Zones",
  },
  selection: {
    tapToChoose: "Tap nodes to select them",
    finishHint: "Each tap picks or drops one node. Press Done to leave.",
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
    dragToConnect: "Drag onto another of your cards to link them",
    titleN: (n) => `Link ${n} nodes`,
    sentiment: "Sentiment",
    linking: "Linking…",
    createLink: "Create link",
    createLinks: (n) => `Create ${n} links`,
    failed: "Failed to create link",
  },
  invite: {
    title: (name) => `Invite to "${name}"`,
    search: "Find someone",
    placeholder: "Username or full email",
    typeMore: "Type at least 2 letters of a username or email.",
    searching: "Searching…",
    noResults: "Nobody found who isn't already on this map.",
    searchFailed: "Search failed",
    inviting: "Inviting…",
    invite: "Invite",
    invited: (username) => `${username ?? "User"} invited.`,
    failed: "Failed to invite",
    notice: (by, name) => `${by} invited you to "${name}".`,
    open: "Open",
    dismiss: "Dismiss",
  },
  username: {
    title: "Choose your username",
    intro: "This is the name others see and search for when they invite you. We filled in your Google name — keep it or pick another.",
    label: "Username",
    hint: "2–32 characters: letters, numbers, spaces, . _ -",
    save: "Save",
    saving: "Saving…",
    keep: "Keep this one",
    failed: "Could not save the username",
    change: "Change username",
  },
  sentiments: { neutral: "neutral", positive: "positive", negative: "negative" },
  node: {
    byUser: (name) => `by ${name}`,
    prevNode: "Previous node (←)",
    textLabel: "Node text",
    formulaPreview: "Formulas preview",
    tabsLabel: "Node sections",
    nextNode: "Next node (→)",
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
    edit: "Edit",
    editTitle: "Open the canvas's own inline editor (text + type)",
    saveText: "Save change",
    saveTextTitle: "Save the edited text",
    pack: "Pack…",
    packTitle: "Fold other linked/branched nodes into this one",
    size: "Size:",
    shape: "Shape:",
    shapes: { circle: "Circle", square: "Square", triangle: "Triangle" },
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
    deletedUndo: "Deleted. Ctrl+Z, Undo or 🗑 brings it back until you close the map.",
    selectToSeeHealth: "Select to see health",
    circleParent: (s) => `Circle parent (${s})`,
    variantParent: (s) => `Variant parent (${s})`,
    zoneName: "Zone name:",
    zoneNamePlaceholder: "Name this zone",
    clickToChangeType: "Click to change type",
    chooseHint: "choose?",
    ghostAgain: "click again to add",
    ghostDrag: "or drag it out to sketch a branch",
    ghostTemplates: {
      "Problem": ["What's blocking us?", "Root cause:", "Risk if we do nothing"],
      "Problematic option": ["Could work, but…", "Hidden cost:", "Weak spot:"],
      "Solution": ["We'll fix it by…", "First step:", "Who owns this?"],
      "Option": ["What if we…", "Alternative:", "Quick experiment:"],
      "Success": ["It worked because…", "Measurable result:", "Keep doing:"],
      "Fail": ["It failed because…", "Lesson learned:", "Don't repeat:"],
      "Idea": ["Idea:", "What if…", "Worth trying:"],
      "unknown": ["Open question:", "Need more info on…", "Idea:"],
    },
    ghostTemplatesTitle: "Start from this phrase",
    ghostChangeTo: (type) => `Make this a ${type}`,
    ghostNewOne: (type) => `New ${type}`,
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
    shape: "Failed to change the shape",
    type: "Failed to update type",
    zone: "Failed to update zone",
    removeLink: "Failed to remove link",
    loadMap: "Failed to load map",
    mapNotFound: "Map not found",
    moveNodes: "Failed to move the selected nodes",
    restoreNode: "Failed to bring the deleted node back",
    joinCircle: "Failed to join circle",
    leaveCircle: "Failed to leave circle",
    dropOnOwnBranch: "Can't drop a node onto its own branch.",
    changeParent: "Failed to change the parent",
    parentNotOwn: "The new parent has to be one of your own nodes.",
    attackParent: "An attack can only hang from another attack.",
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
    cardColor: "Card color",
    cardColorReset: "Default",
    resizeCard: "Drag to resize",
    cardText: "Text size",
    cardShape: "Shape",
    cardShapeRounded: "Rounded",
    cardShapeSquare: "Square",
    cardShapeRound: "Round",
    cardFitText: "Fit to text",
    cardLookFailed: "Couldn't change the card",
    dots: "Dots",
    lockBlock: "Lock this block",
    unlockBlock: "Unlock this block",
    detachPiece: "Unglue this card",
    takePuzzleApart: "Unglue all its cards",
    attachPiece: "Glue back",
    blockLocked: "Locked — unlock to move or edit it",
    magnet: "Call its nodes back",
    magnetHint: "Pulls this node's own nodes that sit outside its zone back next to it",
    magnetNone: "They're all close already",
    zonesInView: "Zones in view",
    mapZones: "Zones on this map",
    zoneLayoutZones: "Separate zones",
    zoneLayoutNested: "Sub-zones inside the zone",
    zoneLayoutNone: "No zones",
    zoneView: (z) => `View of “${z}”`,
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
  inbox: {
    unsorted: (n) => `${n} unsorted note${n === 1 ? "" : "s"}`,
    sort: "Sort",
    hide: "Hide",
    open: "Open Inbox",
    loading: "Loading notes…",
    loadError: "Couldn't load the Inbox notes",
    moveToMap: "Move to a map",
    moveTitle: "Move this note to…",
    noTargets: "No other map yet. Make one first.",
    moving: "Moving…",
    moved: (name) => `Moved to ${name}.`,
    openMap: (name) => `Open ${name} →`,
    moveError: "Couldn't move the note",
    cancel: "Cancel",
    untitled: "(empty note)",
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
    swapWithParent: "Swap with parent",
    swapWithParentHint: "It takes its parent's place and heads the zone; the parent hangs from it",
    changeParent: "Change parent",
    changeParentHint: "Pick another node to hang this one from",
    reparentPick: (name) => `Tap the new parent for “${name}”`,
    reparentHint: "Its branch and its link to the old parent move to the node you tap. Tap its own parent to make it the head of the zone.",
    reparentSame: "That is already its parent.",
    hideGhosts: "Hide the ghosts",
    showGhosts: "Show the ghosts again",
    takeParentPlace: "Couldn't make it the head of the zone.",
  },
  cardFit: {
    packed: "Too many cards for one screen, so they come one zone at a time, in order. Step with ◀ ▶ or a card's +N.",
    topIdeas: "Top ideas",
    zone: (n) => `Zone ${n}`,
    back: "Previous zone",
    next: "Next zone",
    showAll: "Show every card at once, branches packed",
    tooMany: (n) => `Too many cards for the cards view, even with every branch packed: ${n} top card${n === 1 ? "" : "s"} don't fit.`,
    moveExtra: (n) => `Move ${n} to another map`,
    moveTitle: (n) => `Move ${n} card${n === 1 ? "" : "s"} (with their branches) to…`,
    newMap: "+ New map",
    newMapName: (name) => `${name} (2)`,
    moved: (n, name) => `Moved ${n} card${n === 1 ? "" : "s"} to ${name}.`,
  },
  minimapTitle: "Minimap — click or drag to jump around the map",
  autoPack: {
    pack: "Pack its branch",
    unpack: "Unpack its branch",
    hint: "Tuck everything below this node in, to see the map without its details (only for you)",
    open: (n) => `${n} packed in — tap to open`,
    views: { map: "Whole map", overview: "Overview", cards: "Cards" },
    viewHints: {
      map: "Every node, with its links and zones",
      overview: "Each parent packs its last details in, so you see what the map is about",
      cards: "Cards close together, no links: drag them side by side to compare",
    },
    viewLabel: "View",
    layClose: "Lay the cards close",
    layCloseHint: "Put every card back close together, in reading order",
    packAll: "Pack all",
    unpackAll: "Unpack all",
    packAllHint: "Pack every branch in, leaving only the top of each (only for you)",
    unpackAllHint: "Open every packed branch again",
    promptTitle: "How would you like to look at this map?",
    promptClose: "Close",
  },
  abstraction: {
    title: "Level of abstraction — fewer levels show only the bigger ideas",
    label: "Detail",
    all: "All",
    level: (n, total) => `Level ${n} of ${total}`,
    hidden: (n) => `${n} hidden`,
    lessDetail: "Fewer levels",
    moreDetail: "More levels",
    view: "View",
    moreText: "More text",
    lessText: "Less text",
    minimap: "Minimap",
    menu: "View controls: view and minimap",
    simpler: "Simpler",
    richer: "More detail",
    levels: "Levels",
    fineTune: "Fine-tune",
  },
  zoneStyle: { pattern: "Pattern", color: "Colour", none: "None", auto: "Auto", autoHint: "Colour by sentiment", takenBy: (name) => `taken by ${name}`, edge: "Edge brightness", view: "Show zone as", patterns: { dots: "Dots", stripes: "Stripes", grid: "Grid", chess: "Chess" }, colors: { sand: "Sand", sage: "Sage", sky: "Sky", lavender: "Lavender", rose: "Rose", slate: "Slate" } },
  nodeFade: { label: "Fade quiet nodes", off: "None", full: "Full" },
  mapBackground: { title: "Background", options: { dots: "Dot grid", plain: "Plain", lined: "Lined paper", dark: "Soft dark" }, picture: "Your picture…", changePicture: "Change picture…", removePicture: "Remove picture", pictureFailed: "Couldn't set the picture.", shade: "Picture brightness", darker: "Darker", lighter: "Lighter", choosePart: "Choose the part to show…", cropTitle: "Choose the part to show", cropHint: "Drag the frame to move it, drag a corner to resize it.", cropFrame: "The part kept", cropCancel: "Cancel", cropWhole: "Whole picture", cropUse: "Use this part" },
  gestureHint: {
    title: "How to use the map",
    touch: [
      "Tap a node to open it; tap a ring around it to add a thought.",
      "Drag a node to move it. Hold and lift to pick it, pick more for a group, then drag the group.",
      "Hold a zone for its menu: copy its text, shape, delete, look.",
      "Double-tap empty space for a new node; hold it for a menu: templates, paste.",
      "Pinch to zoom; the eye sets how much detail you see.",
    ],
    mouse: [
      "Click a node to open it; click a ring around it to add a thought.",
      "Shift+click or drag on empty space to pick a group, then drag the group.",
      "Right-click a zone for its menu: copy its text, shape, delete, look.",
      "Double-click empty space for a new node; right-click it for a menu: templates, paste.",
      "Ctrl+wheel or − / + to zoom; the eye sets how much detail you see.",
    ],
    gotIt: "Got it",
  },
  panelDragHandle: "Drag to move this panel",
  panelResizeHandle: "Drag to resize this panel",
  textOverflow: {
    message: (extra, max) => `${extra} more characters didn't fit: a node holds ${max}.`,
    carry: (n) => (n === 1 ? "Put them in a new node" : `Put them in ${n} new nodes`),
    leave: "Leave them out",
    willCarry: (n) => (n === 1 ? "The rest goes into a new node right after this one." : `The rest goes into ${n} new nodes right after this one.`),
    undo: "Undo",
    carried: (n) => (n === 1 ? "The rest is in a new node" : `The rest is in ${n} new nodes`),
    failed: "Couldn't make the new node for the rest",
  },
  newNode: { title: "New node", placeholder: "Write your thought…", create: "Create", hint: "Enter creates it, Shift+Enter adds a line", ghost: "Ghost", ghostHint: "Write a question instead of an answer: the node stays faded until someone fills it in", ghostPlaceholder: "Write the question to answer later…", createGhost: "Create ghost" },
  quiz: {
    entry: "Quiz me",
    exit: "Exit",
    count: (c, n) => `${c} / ${n}`,
    showAnswer: "Show answer",
    hint: "Answer in your head or write it below, then turn the card",
    guessPlaceholder: "Write your answer (optional)…",
    yourGuess: "Your answer",
    trueAnswer: "Answer",
    notYet: "Not yet",
    shaky: "Shaky",
    know: "Know it",
    back: "Back",
    roundDone: "Round done",
    tally: (k, s, y) => `Know it ${k} · Shaky ${s} · Not yet ${y}`,
    again: "Go over the shaky ones",
    restart: "Start again",
    done: "Done",
    empty: "Nothing to quiz yet: give a node children, or a title and a text",
  },
  presentation: {
    exit: "Exit",
    prev: "Prev",
    next: "Next",
    slideCount: (current, total) => `${current} / ${total}`,
    under: (parent) => `Under: ${parent}`,
    showOnMap: "Show on map ↗",
    empty: "Nothing to present yet — add a node first",
    presentZone: "Present this zone",
    slidesTab: "Slides",
    summaryTab: "Summary",
    filterTypes: "Show types",
    allTypes: "All",
    noMatch: "No nodes of these types",
    answersTitle: "Answers",
    level: (n) => `Level ${n}`,
    questions: "Questions",
    answeredOf: (a, total) => `${a} of ${total} answered`,
    notAnswered: "Not answered yet",
    locked: (prev) => `Opens once level ${prev} is filled in`,
    otherNotes: "Your other notes",
    byTypeTitle: "By type",
  },
  exportText: { title: (name) => `Export text — "${name}"`, download: "Download .md" },
  summary: {
    title: (name) => `Summary — "${name}"`,
    nodes: (n) => `${n} node(s)`,
    members: (n) => `${n} member(s)`,
  },
  think: THINK_STRINGS.en,
  siege: SIEGE_STRINGS.en,
  feelings: FEELING_STRINGS.en,
  cardMenuLabel: "Map menu",
  offline: {
    offline: "Offline · saved on this device",
    offlinePending: (n) => `Offline · ${n} to sync later`,
    pending: (n) => `${n} to sync`,
    syncing: (n) => `Syncing ${n} ${n === 1 ? "change" : "changes"}…`,
    synced: "All changes synced.",
    syncNow: "Sync now",
    signIn: (n) => `Sign in again to sync ${n} ${n === 1 ? "change" : "changes"} made offline.`,
    failed: (n, e) => `${n} offline ${n === 1 ? "change" : "changes"} couldn't be saved: ${e}`,
    dismiss: "Dismiss",
  },
  images: {
    title: "Pictures",
    add: "🖼️ Picture",
    hint: "or paste (Ctrl+V) / drop one into the text",
    remove: "Remove picture",
    open: "Open full size",
    close: "Close",
    prev: "Previous picture",
    next: "Next picture",
    loading: "Loading pictures…",
    limit: (max) => `Up to ${max} pictures per node`,
    tooLarge: "That picture couldn't be used — try a smaller one.",
    failed: "Couldn't save the pictures",
    selectNode: "Open one of your nodes first, then paste the picture into it",
    useAsIcon: "Use as icon",
    isIcon: "Icon",
    removeIcon: "Back to the type's symbol",
    useAsCard: "Show as card",
    isCard: "Card",
    removeCard: "Take the card off the map",
    iconFailed: "Couldn't change how the picture shows",
    templates: "✨ Template",
    templatesHint: "Add a ready-made picture",
    templateFailed: "Couldn't load that picture. Check the connection and try again.",
    templateNames: {
      eyes: "Eyes",
      clockHeads: "Clock heads",
      martini: "Smiling martini",
      fishing: "Fishing for time",
      yoyo: "Yin-yang yo-yo",
      clockJuice: "Squeezed time",
      orangeClock: "Orange clock",
      puppet: "Puppet hand",
      heartMirror: "Heart and mirror",
      lightbulb: "Light bulb",
    },
  },
  emoji: {
    label: "Emoji",
    current: "Current emoji",
    remove: "Remove",
    customPlaceholder: "Any other emoji…",
    use: "Use",
    invalid: "That isn't an emoji",
    failed: "Couldn't change the emoji",
    first: "Emoji first",
    firstHint: "Every node shows an emoji face up (its own, or its type's), and new nodes offer the emoji before the type; choosing a node flips it to its type for a moment. Turned off, the type's symbol is up and an emoji is optional",
    typeEmoji: "Emoji for each type",
    typeEmojiHint: "A node without its own emoji shows its type's symbol, or the emoji you pick here",
    typeSymbol: "Its own symbol",
    typeEmojiReset: "Default",
    still: "Keep this emoji still",
    stillHint: "It stays face up and never turns over to the type",
    ringPrompt: "How does it feel?",
    skip: "No emoji",
    feelings: ["Happy", "Excited", "Calm", "Thoughtful", "Confused", "Worried", "Sad", "Angry"],
  },
  textNodes: {
    entry: "✂ Text → nodes here",
    title: "Text → nodes",
    hint: "Paste or write a text. Pick out its pieces — each one becomes a node right where you clicked.",
    withRoot: "Keep the whole text as a main node (the pieces hang from it)",
    rootHangsFrom: "The main node hangs from",
    next: "Next: mark pieces →",
    back: "← Back",
    markHint: "Tap where a piece starts and where it ends, then choose what it is — or cut the text up automatically.",
    splitLines: "Each line → node",
    splitSentences: "Each sentence → node",
    add: (n) => `Add ${n} ${n === 1 ? "node" : "nodes"}`,
    adding: (done, total) => `Adding… ${done} of ${total}`,
    nothing: "Mark at least one piece, or keep the main node.",
    noRoom: "There's no free room left on this map — move, delete or pack some nodes first.",
    overflowTitle: "Not everything fits",
    overflow: (fit, total) => `There's room on the map for ${fit} of the ${total} new nodes.`,
    packHint: (need) =>
      `Choose at least ${need} ${need === 1 ? "piece" : "pieces"} to pack into the main node — they're folded inside it, and you can unpack them later from its “Packed” tab.`,
    packNeedsRoot: "Packing folds pieces into the main node — turn it on to pack.",
    useRoot: "Use a main node",
    picked: (picked, need) => `${picked} chosen · at least ${need}`,
    addAndPack: (shown, packed) => `Add ${shown}, pack ${packed}`,
    created: (n, packed) =>
      packed > 0 ? `${n} ${n === 1 ? "node" : "nodes"} added, ${packed} packed into the main node` : `${n} ${n === 1 ? "node" : "nodes"} added`,
    failed: "Couldn't add the nodes",
    splitEntry: "✂ Split into nodes…",
    splitEntryTitle: "Cut this node's text into smaller nodes that hang from it",
    splitTitle: "Split into nodes",
    splitHint: "Tap the word a piece starts on, then the word it ends on, and give it a type — or cut the text by lines or sentences in one go. Each piece becomes a node hanging from this one.",
    thisNode: "This node",
    takeOut: "Take the pieces out of this node's text",
    keeps: (text) => `This node keeps: “${text.length > 80 ? `${text.slice(0, 80)}…` : text}”`,
    keepsAll: "This node keeps its whole text.",
    nothingLeft: "The pieces take the whole text, so this node keeps it as it is.",
  },
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
    deleteConfirm: (u) => `Delete ${u}? This deletes everything they made: their maps, their nodes and links on other maps, folders, drafts and pictures.`,
    wipeConfirm: "Wipe the ENTIRE database — all users, maps and nodes? This cannot be undone.",
    wipeConfirmAgain: "Are you absolutely sure? Type-of-no-return confirmation #2.",
    usage: {
      title: "How the app is used",
      hint: "Counted from what signed-in people do, never what their thoughts say. Browsers that ask not to be tracked are left out.",
      days: (n) => `Last ${n} days`,
      includeDemo: "Include demo accounts",
      optedOut: "This browser asks sites not to track it (Do Not Track or Global Privacy Control), so nothing you do in it is counted. Turn that setting off, or use another browser, to see your own activity here.",
      loading: "Loading usage…",
      failed: "Couldn't load usage",
      today: "Active today",
      week: "Active, 7 days",
      month: "Active, 30 days",
      returning: "Came back another day",
      users: "Accounts",
      newUsers: "New accounts",
      maps: "Maps made",
      nodes: "Nodes made",
      dailyTitle: "People active each day",
      dayTip: (d, u, e) => `${d}: ${u} ${u === 1 ? "person" : "people"}, ${e} actions`,
      event: "What they did",
      times: "Times",
      people: "People",
      none: "Nothing recorded yet.",
      events: {
        app_opened: "Opened the app",
        page_viewed: "Opened a page",
        signed_up: "Signed up",
        signed_in: "Signed in",
        demo_started: "Tried the demo",
        quick_note_added: "Added a quick note",
        map_created: "Made a map",
        node_created: "Added a node",
        search_used: "Searched",
        think_started: "Started Think it through",
        think_finished: "Finished Think it through",
        feeling_set: "Marked a feeling",
        checked_in: "Checked in how they feel",
        text_split: "Split text into nodes",
        picture_drawn: "Drew a picture",
        view_changed: "Picked a view",
        map_shared: "Shared a map",
        node_attacked: "Attacked a node",
        node_protected: "Protected a node",
        map_finished: "Finished a discussion",
        replay_played: "Played the replay",
      },
      featuresTitle: "Every feature, least used first",
      featuresHint: "Features nobody used in this period are at the top: candidates to improve, explain better or remove.",
      feature: "Feature",
      neverUsed: "not used",
      features: {
        edit_text: "Edited a node's text",
        title: "Gave a node a title",
        change_type: "Changed a node's type",
        node_style: "Changed a node's look (shape, size, emoji)",
        reorder: "Reordered nodes",
        node_pictures: "Added pictures to a node",
        zones: "Named or styled a zone",
        change_parent: "Changed a node's parent",
        swap_parent: "Swapped a node with its parent",
        move_nodes: "Moved nodes",
        delete_nodes: "Deleted nodes",
        link_nodes: "Linked two nodes",
        draw_line: "Drew a line",
        pack: "Packed nodes into one",
        hide_branch: "Hid a branch",
        circles: "Picked a circle",
        map_background: "Changed the map background",
        discussion_mode: "Switched discussion / personal mode",
        rename_map: "Renamed or recoloured a map",
        delete_map: "Deleted a map",
        folders: "Used folders",
        history: "Opened the discussion history",
        presentation: "Presented a map",
        copy_paste: "Copied or pasted nodes",
        undo: "Undid a move",
        export: "Exported a map as text",
        minimap: "Turned the minimap on or off",
        opponent_turn: "Played the imitated opponent",
        quick_add: "Added a node from the ring",
        quiz: "Quizzed themselves (Quiz me)",
      },
    },
  },
};

// Only English ships in the main bundle; the other languages live in
// locales/<language>.ts and load when picked (translations.ts loadTranslation).
export const UI_STRINGS: { en: UiStrings } = { en };
