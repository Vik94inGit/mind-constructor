import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { TemplateProgress } from "../utils/templateLevels";
import * as nodesApi from "../api/nodes";
import * as edgesApi from "../api/edges";
import { ApiRequestError } from "../api/client";
import { allowedAttackTypes, sentimentOf, idOf, nodeRefId, usernameOf } from "../utils/nodeType";
import { NODE_TYPE_TEMPLATE } from "../utils/templates";
import { PictureDotsList, PictureDotsMap, pictureGroupOf } from "./nodePanel/PictureDots";
import type { NodeTemplateKind, TemplateKind } from "../utils/templates";
import { NodeTypeSymbol } from "./NodeTypeSymbol";
import { ringKindFor } from "./OutcomeBadge";
import { ATTACK_NODE_TYPES } from "../types";
import type { Attack, AttackNodeType, EdgeDoc, ManualZoneColor, NodeDoc, NodeShape, NodeType, SizeTier, SymbolOverride, Weapon } from "../types";
import { useI18n } from "../i18n/I18nContext";
import { usePanelSheet } from "./nodePanel/usePanelSheet";
import { useNodeImages } from "./nodePanel/useNodeImages";
import type { Feeling } from "../utils/feeling";
import { InfoTab } from "./nodePanel/InfoTab";
import type { CardLook } from "./nodePanel/InfoTab";
import { ModifyTab } from "./nodePanel/ModifyTab";
import { AttackTab } from "./nodePanel/AttackTab";
import { ProtectTab } from "./nodePanel/ProtectTab";
import { PackedTab } from "./nodePanel/PackedTab";
import { HistoryTab } from "./nodePanel/HistoryTab";
import { ImagesSection } from "./nodePanel/ImagesSection";
import { MAX_NODE_TEXT } from "../utils/nodeText";
import { moveRovingFocus } from "../utils/roving";
import { track } from "../utils/usage";
import { ErrorBanner } from "../components/ErrorBanner";

// A bottom sheet over the canvas at every screen size; tapping empty canvas
// closes it too (MapPage's onClick). Docked at half the screen so it opens
// under the node: MapPage's centerOnNode parks the chosen node in the half
// left above it, and viewportBounds keeps new nodes and ghosts out of it, so
// that half (panelReserveFrac) must match the h-[50dvh] here. `dvh`, not
// `vh`: on a phone, `vh` counts space behind the sliding address bar. z-[46]
// sits above the minimap cluster (z-45) and below a real modal (z-50). The
// content scrolls inside; the resize handle stays pinned to the top edge.
const PANEL_CLASS =
  "fixed inset-x-0 bottom-0 z-[46] flex h-[50dvh] w-full flex-col rounded-t-2xl border-t border-line bg-surface shadow-[var(--shadow-card)]";


// The header only ever shows the type icon and a two-line clamp of the
// node's own text (see the header markup below); everything else — text,
// health, CRUD, links, the whole attack form, and history — lives behind
// one of these tabs, one screenful at a time, rather than stacked and
// visible all at once (which would make this panel the tallest thing on
// the page for even the plainest node). Which tabs actually show up (and
// which one opens by default) still depends on the node — see tabsFor below.
type Tab = "info" | "links" | "attack" | "protect" | "pack" | "history";

const closeBtn =
  "inline-flex flex-shrink-0 cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-transparent bg-transparent px-[0.5rem] py-[0.3rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50";
// The previous/next node arrows in the sheet's bottom row: big round targets.
const stepBtn =
  "inline-flex h-[2.75rem] w-[2.75rem] flex-shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-surface-2 text-[1.5rem] leading-none font-semibold text-ink shadow-sm transition-[background-color,border-color] duration-[120ms] hover:border-ink-soft active:bg-line";
const tabBtn = (active: boolean) =>
  `inline-flex cursor-pointer items-center justify-center gap-[0.3rem] rounded-lg border px-[0.6rem] py-[0.3rem] text-[0.76rem] font-semibold transition-[background-color,border-color,opacity] duration-[120ms] disabled:cursor-not-allowed disabled:opacity-50 ${
    active
      ? "border-accent bg-accent-soft text-accent-ink"
      : "border-line bg-surface text-ink-soft enabled:hover:bg-surface-2"
  }`;

interface Props {
  node: NodeDoc;
  nodes: NodeDoc[];
  edges: EdgeDoc[];
  currentUserId: string;
  /** MapPage's isDiscussionMode — Discussion (battle) mode: attacks hurt and members are limited in which node types they may attack with. Personal (creating) mode: attacks still add their node but do no damage, and the Protect tab is hidden. */
  discussionMode: boolean;
  /** The current user created this map. In battle mode the owner may attack with any node type; everyone else is limited (see allowedAttackTypes). */
  isMapOwner: boolean;
  /** Grows a template branch from this node (see utils/templates.ts). Resolves once every node is created. */
  onApplyTemplate: (kind: TemplateKind) => Promise<void>;
  onClose: () => void;
  /** Deletes the node (MapPage's deleteNodeWithUndo) — false when the person cancelled; throws on failure. */
  onDelete: (node: NodeDoc) => Promise<boolean>;
  /** Fired after a direct panel-side PATCH (currently just the symbol-override toggle below) with the server's response, so the canvas/other panels stay in sync — same upsert-by-id MapPage already does for every other node update. */
  onUpdated: (node: NodeDoc) => void;
  /** healedParent: set only when this landed as a retaliation — see attackAbl.ts's own healedParent doc comment. null on an ordinary attack. blocked: true when a linked, undefeated protection node stopped this attack outright. protector: that protection node's own updated document (its blockedDamage bumped) when blocked, else null. */
  onAttacked: (
    node: NodeDoc,
    weaponNode: NodeDoc,
    weapon: Weapon,
    healedParent: NodeDoc | null,
    blocked: boolean,
    protector: NodeDoc | null,
  ) => void;
  onDeleteEdge: (edgeId: string) => void;
  onStartChoose: () => void;
  onSelectNode: (nodeId: string) => void;
  /** Text/type editing now happens inline on the node's own icon on the canvas — this just asks the canvas to turn it on. No-ops there if editing isn't currently allowed. */
  onEdit: () => void;
  /** A new protection node landed, aimed at this node — MapPage upserts it same as any other node. healedNode: this node's own updated document, immediately healed once by the new shield. */
  onProtected: (protectionNode: NodeDoc, healedNode: NodeDoc) => void;
  /** Asks MapPage to open the pack picker for this node (owner-only — see the Info tab's Pack button). */
  onStartPack: () => void;
  /** One packed member got unpacked back to a normal, visible node. */
  onUnpacked: (node: NodeDoc) => void;
  /** True when this node is a circle's own root/parent (2+ direct parentId-children — MapPage's circleRootSentimentByNode). Gates the Info tab's "Extract text" button (the zone's own right-click menu has it too): the whole-map export lives in the "+" toolbar menu only, so a plain non-parent node's panel offers no text export at all. */
  isClusterParent: boolean;
  /** Asks MapPage to open a text export scoped to this node's own cluster — plus, recursively, any cluster rooted at one of its children (see MapPage's collectClusterSubtree). Only ever called when isClusterParent is true. */
  onExtractText: () => void;
  /** Opens "Split into nodes" on this node; absent when its text can't be split (a weapon, a shield, one word). */
  onSplitText?: (text: string) => void;
  /** Text pasted past the node's limit, put into new nodes carrying on from it (see InfoTab). */
  onCarryText?: (rest: string) => Promise<boolean>;
  /** Set while this node is drawn as a puzzle card: its fill (the viewer's own, see utils/cardFill.ts) and how to change it. */
  cardFill?: { value: string | undefined; onChange: (color: string | null) => void } | null;
  /** The viewer's own feeling about this thought (utils/feeling.ts) and how to change it — anyone may, it's only theirs. */
  feeling?: { value: Feeling | undefined; onChange: (feeling: Feeling | null) => void } | null;
  /** Set while this node is drawn as a card and is the viewer's own: its text size and shape, whether it has its own size, and how to change them (Node.cardFont/cardShape/cardW/cardH). */
  cardLook?: CardLook;
  /** Its owner locked this text block (utils/blockLock.ts): the text reads as for anyone else's node until unlocked. */
  textLocked?: boolean;
  /** Set on a locked ghost of a leveled template (utils/templateLevels.ts): why it can't be written in yet. */
  levelLock?: string;
  /** Where the leveled template grown from this node stands (utils/templateLevels.ts templateProgress). */
  levelProgress?: TemplateProgress;
  /** Locks/unlocks this node — owner only. */
  onToggleLock?: () => void;
  /** Set on a parent with nodes of yours: pulls those outside its zone back in (utils/parentMagnet.ts), resolving to how many moved. */
  onMagnet?: () => Promise<number>;
  /** Change parent: pick another node to hang this one from (MapPage's reparent mode). */
  onChangeParent?: () => void;
  /** Auto-pack: set on a parent — tucks its branch in for a glance, or opens it again (see InfoTab). */
  onAutoPack?: () => void;
  autoPacked?: boolean;
  /** Swap with parent: this node takes its parent's place as head of the zone (utils/edgeRedirect.ts takeParentPlace). */
  onSwapWithParent?: () => void;
  /** Move to a map: shown on the Inbox's notes (utils/inbox.ts). */
  onMoveToMap?: () => void;
  /** The ring of ghosts around the opened node, and the 👻 that hides it. */
  ghostsHidden?: boolean;
  onToggleGhosts?: () => void;
  /** Set right after this node was created: open on its text, focused, ready to write more. Fired back through onAutoFocused once done. */
  autoFocusText?: boolean;
  onAutoFocused?: () => void;
  /** Opens the previous (-1) or next (1) node in reading order (utils/nodeOrder.ts) — the text's arrow keys. */
  /** Read the previous / next node; `focusText: false` keeps focus where it is (the header's buttons). */
  onStepNode?: (dir: -1 | 1, focusText?: boolean) => void;
  // One of several panels open at once (docs/gestures/several-panels.md): it
  // fills its tile instead of docking as the sheet, and can't be dragged or
  // resized.
  tiled?: boolean;
  // The active panel (the node last tapped): an accent border when tiled.
  active?: boolean;
  // A press inside a tiled panel that isn't active makes it the active one.
  onActivate?: () => void;
}

// A tile among several open panels (MapPage's grid lays them out).
const TILE_CLASS =
  "relative flex h-full min-h-0 w-full min-w-0 flex-col rounded-2xl border bg-surface shadow-[var(--shadow-card)]";

export function NodePanel({
  onStepNode,
  tiled = false,
  active = true,
  onActivate,
  node,
  nodes,
  edges,
  currentUserId,
  discussionMode,
  isMapOwner,
  onApplyTemplate,
  onClose,
  onDelete,
  onUpdated,
  onAttacked,
  onDeleteEdge,
  onStartChoose,
  onSelectNode,
  onEdit,
  onProtected,
  onStartPack,
  onUnpacked,
  isClusterParent,
  onExtractText,
  onSplitText,
  onCarryText,
  cardFill,
  feeling,
  cardLook,
  textLocked = false,
  levelLock,
  levelProgress,
  onToggleLock,
  onMagnet,
  onChangeParent,
  onAutoPack,
  autoPacked,
  onSwapWithParent,
  onMoveToMap,
  ghostsHidden = false,
  onToggleGhosts,
  autoFocusText = false,
  onAutoFocused,
}: Props) {
  const { t } = useI18n();
  const isCreator = idOf(node.userId) === currentUserId;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Attack[] | null>(null);
  // An attack now creates a real node — this is that node's content, filled
  // in before any of the weapon buttons below will actually fire.
  const [attackText, setAttackText] = useState("");
  const [attackType, setAttackType] = useState<NodeType>("Problem");
  // Same shape as the attack draft, for the Protect tab.
  const [protectText, setProtectText] = useState("");
  const [protectType, setProtectType] = useState<AttackNodeType>("Solution");

  // Direct text editing, right inside the Info tab (see the textarea in the
  // JSX below) — reset from the node's real text whenever the selected node
  // changes, same reset-on-node-change contract attackText/attackType
  // already follow just below. Enter submits (calls updateNode, same
  // pattern as handleSetSymbol); Shift+Enter inserts a newline instead —
  // this is now the panel's primary text-edit affordance, alongside the
  // canvas's own inline editor (double-click a node, or the Edit button
  // below, both of which still hand off to that same inline editor).
  const [textDraft, setTextDraft] = useState(node.text);
  // The optional canvas title (see NodeDoc.title) — its own single-line
  // field above the text, saved on Enter/blur the same way the text is.
  // Unlike text it's never lazy-loaded, so there's no backfill to wait for.
  const [titleDraft, setTitleDraft] = useState(node.title ?? "");
  // The zone name, for a circle parent (see NodeDoc.zoneName).
  const [zoneNameDraft, setZoneNameDraft] = useState(node.zoneName ?? "");
  // The optional step number, as typed — a string so the field can be empty
  // or half-typed; parsed on save.
  const [orderDraft, setOrderDraft] = useState(node.order != null ? String(node.order) : "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // A non-owner's read-only text block, which resizes along with the panel too.
  const readonlyTextRef = useRef<HTMLDivElement>(null);
  // Transient "Copied!" confirmation on the Info tab's own Copy button —
  // auto-clears, same pattern the mobile-focused parts of this file already
  // favor over a persistent status line for a one-off confirmation.
  const [copied, setCopied] = useState(false);
  // The Info tab's "show all" toggle: lifts the text box's height cap so it
  // grows to fit (the sheet scrolls instead), since a textarea's own resize
  // grip is easy to miss, doesn't work by touch and a non-owner's read-only
  // text has none.
  const [expanded, setExpanded] = useState(false);

  // Dragging the sheet off its bottom dock and resizing it — see
  // usePanelSheet.
  const { panelRef, dragOffset, setDragOffset, panelHeight, setPanelHeight, textHeight, onResizeHandlePointerDown, onGripPointerDown } =
    usePanelSheet({ textareaRef, readonlyTextRef });

  // A weapon node's own targetNodeId — only ever meaningful when isWeapon,
  // surfaced as a "Points at" link in the Info tab below, and used by
  // canAttack right below to decide whether this is a retaliation.
  const targetId = node.isWeapon ? nodeRefId(node.targetNodeId) : undefined;
  const target = targetId ? nodes.find((n) => n.nodeId === targetId) : undefined;
  // An attack from the other side (another member's, or the imitated
  // opponent's) on one of your own nodes: its Attack tab is set to strike back.
  const strikeBack = discussionMode && !!target && idOf(target.userId) === currentUserId && (!!node.byOpponent || !isCreator);

  // Same idea, for a protection node's own protectsNodeId — surfaced as a
  // "Protects" line in the Info tab, exact mirror of "Points at" above.
  const protectedId = node.isProtection ? nodeRefId(node.protectsNodeId) : undefined;
  const protectedTarget = protectedId ? nodes.find((n) => n.nodeId === protectedId) : undefined;

  // The reverse direction: every protection node currently guarding *this*
  // node (there can be more than one) — surfaced as a "Protected by" list.
  const protectors = nodes.filter((n) => n.isProtection && nodeRefId(n.protectsNodeId) === node.nodeId);

  // Every node currently packed into this one — the Pack tab's own list.
  // Only ever non-empty for a container; a packed member's own panel would
  // never show this (a packed node is hidden from the canvas entirely, so
  // its panel can't be open in the first place).
  const packedMembers = nodes.filter((n) => nodeRefId(n.packedIntoNodeId) === node.nodeId);

  // Which node types this attack may carry: in battle mode the owner may use
  // anything, everyone else is limited by the target's side (mirrors
  // attackAbl.ts, which enforces it); in Personal mode anyone gets the owner's
  // set (every type an attack may be, which leaves out the study types).
  const attackTypes: NodeType[] = allowedAttackTypes(!discussionMode || isMapOwner, node.type);
  // The type actually sent: the picked one while it is still allowed, else
  // the first allowed (a mode flip or a different target can invalidate it).
  const effectiveAttackType = attackTypes.includes(attackType) ? attackType : attackTypes[0];
  const attackHint = !discussionMode
    ? t.ui.attack.hintPersonal
    : isMapOwner
      ? null
      : sentimentOf(node.type) === "negative"
        ? t.ui.attack.hintNegativeTarget
        : t.ui.attack.hintPositiveTarget;

  // Growing a template branch — only offered on a node that has no branch
  // yet (Problem, Solution or Idea: a ready structure; Fail: analyze and retry).
  const hasChildren = nodes.some((n) => nodeRefId(n.parentId) === node.nodeId);
  // A dot of a "Draw a picture": its Info tab opens on the picture's dots.
  const pictureGroup = useMemo(() => pictureGroupOf(node, nodes), [node, nodes]);
  const templateKind: NodeTemplateKind | null =
    !isCreator || hasChildren || node.isWeapon || node.isProtection ? null : (NODE_TYPE_TEMPLATE[node.type] ?? null);
  // Only an outcome type (see OutcomeBadge.tsx) actually draws an inner
  // symbol at all — "unknown" nodes render the plain NodeTypeIcon glyph
  // instead, nothing here to override.
  const isOutcome = !!ringKindFor(node.type);

  // Which tabs this node has anything behind, and which one opens by
  // default — every node gets Info/Links/Attack/Protect/History; Pack only
  // once the node actually has something packed into it (nothing to show
  // otherwise — the Pack *action* itself lives as a button in Info, not
  // behind its own tab, since starting a pack hands off to MapPage's own
  // picker sheet rather than rendering anything further in here).
  const tabs: Tab[] = [
    "info",
    "links",
    // Personal maps have no attacks to make: Attack and Protect only in Discussion.
    ...(discussionMode ? (["attack", "protect"] as const) : []),
    ...(packedMembers.length > 0 ? (["pack"] as const) : []),
    "history",
  ];
  const [tab, setTab] = useState<Tab>("info");
  const tabIdBase = useId();
  const { images, add: handleAddImages, remove: handleRemoveImage, setAs: setImageAs, onPanelPaste } = useNodeImages({
    node,
    canEdit: isCreator,
    t,
    run,
    setError,
    onUpdated,
    onPasted: () => setTab("info"),
  });

  // Lifting the cap doesn't grow a textarea by itself: while expanded it is
  // set to its scrollHeight on every keystroke; collapsing goes back to the
  // height the panel resize gave it, or to the CSS default.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (expanded) {
      ta.style.height = "auto";
      ta.style.height = `${ta.scrollHeight}px`;
    } else {
      // Back to the size the panel resize gave it, if any.
      ta.style.height = textHeight != null ? `${textHeight}px` : "";
    }
    // `tab`: the textarea remounts whenever the Info tab is reopened.
  }, [expanded, textDraft, textHeight, tab]);

  // Someone (the owner) flipped Discussion/Personal mode while this panel
  // was already open on the Attack or Protect tab — that tab's own button
  // just vanished from the row above (see `tabs`), so fall back to Info
  // rather than leaving `tab` pointed at a pane with no button and no
  // content (both content blocks below are gated by the same discussionMode
  // check, so it would otherwise render as a silently blank sheet).
  useEffect(() => {
    if (!discussionMode && (tab === "attack" || tab === "protect")) setTab("info");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discussionMode]);

  useEffect(() => {
    setError(null);
    setAttackText("");
    // A strike back answers a negative attack with a positive node, and
    // anything else with a problem.
    setAttackType(strikeBack && sentimentOf(node.type) === "negative" ? "Solution" : "Problem");
    setProtectText("");
    setProtectType("Solution");
    setTextDraft(node.text);
    setTitleDraft(node.title ?? "");
    setZoneNameDraft(node.zoneName ?? "");
    setOrderDraft(node.order != null ? String(node.order) : "");
    setExpanded(false);
    setDragOffset({ x: 0, y: 0 });
    setPanelHeight(null);
    // Every node opens on Info, an attack you could strike back at too: its
    // Attack tab is one tap away, already set to answer it.
    setTab("info");
    nodesApi
      .getAttackHistory(node.nodeId)
      .then(setHistory)
      .catch(() => setHistory([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.nodeId]);

  // The node's text may arrive after the panel opened (it's lazy-loaded, see
  // MapPage's ensureNodeText): fill the draft in once, unless something has
  // been typed since.
  useEffect(() => {
    if (node.text !== "" && textDraft === "") setTextDraft(node.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.text]);

  // Right after this node was created (MapPage's confirmPendingCreate): the
  // Info tab, its text field focused with the caret at the end, so writing
  // more about the new node can start straight away.
  useEffect(() => {
    if (!autoFocusText) return;
    setTab("info");
    const timer = window.setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        const end = ta.value.length;
        ta.setSelectionRange(end, end);
      }
      onAutoFocused?.();
    }, 60);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocusText, node.nodeId]);

  // Every action below: busy while it runs, its error (or `fallback`) shown
  // in the sheet if it throws. Resolves false when it failed, so a caller
  // that closes the panel afterwards (Enter) can leave it open, error showing.
  async function run(fallback: string, action: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : fallback);
      return false;
    } finally {
      setBusy(false);
    }
  }
  // Owner-only, like every node edit: one PATCH, the server's node passed up.
  const patch = (updates: nodesApi.NodeUpdate, fallback: string) =>
    run(fallback, async () => onUpdated(await nodesApi.updateNode(node.nodeId, updates)));

  // A text field saved on Enter/blur: a no-op (and the draft reset) when
  // unchanged. Empty text is a no-op too, like the canvas's inline editor;
  // an empty title or zone name clears it.
  function saveField(field: "text" | "title" | "zoneName", draft: string, reset: (v: string) => void, fallback: string) {
    const current = node[field] ?? "";
    const trimmed = draft.trim();
    if (trimmed === current || (field === "text" && !trimmed)) {
      reset(current);
      return Promise.resolve(true);
    }
    return patch({ [field]: trimmed }, fallback);
  }
  const handleTextSave = () => saveField("text", textDraft, setTextDraft, t.ui.errors.text);
  const handleTitleSave = () => saveField("title", titleDraft, setTitleDraft, t.ui.errors.title);
  const handleZoneNameSave = () => saveField("zoneName", zoneNameDraft, setZoneNameDraft, t.ui.errors.zone);

  // A blank field clears the step number; anything else has to be a whole
  // number from 1 to 9999 (the backend's own bounds). No-op if unchanged.
  async function handleOrderSave(): Promise<boolean> {
    const current = node.order ?? null;
    const trimmed = orderDraft.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next !== null && (!Number.isInteger(next) || next < 1 || next > 9999)) {
      setError(t.ui.errors.order);
      setOrderDraft(current !== null ? String(current) : "");
      return false;
    }
    return next === current ? true : patch({ order: next }, t.ui.errors.order);
  }

  // Copies the node's real text (not the draft, so it works the same for a
  // non-owner) — reading a node's text isn't an edit, so anyone may.
  async function handleCopyText() {
    try {
      await navigator.clipboard.writeText(node.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(t.ui.errors.clipboard);
    }
  }

  const handleDelete = () => run(t.ui.errors.delete, () => onDelete(node));
  const handleTemplate = (kind: TemplateKind) =>
    run(t.ui.templates.failed, async () => {
      await onApplyTemplate(kind);
      onClose();
    });

  // Landing an attack (blocked or not) or a shield creates a real node, so
  // the panel closes like every other node-creating action.
  async function handleAttack(weapon: Weapon) {
    if (!attackText.trim()) return;
    await run(t.ui.errors.attack, async () => {
      const res = await nodesApi.attackNode(node.nodeId, weapon, { type: effectiveAttackType, text: attackText.trim() });
      track({ name: "node_attacked", props: { weapon } });
      onAttacked(res.node, res.weaponNode, weapon, res.healedParent, res.blocked, res.protector);
      onClose();
    });
  }

  // Only the target's owner may (protectNodeAbl enforces it too).
  async function handleProtect() {
    if (!protectText.trim()) return;
    await run(t.ui.errors.protect, async () => {
      const res = await nodesApi.protectNode(node.nodeId, { type: protectType, text: protectText.trim() });
      track({ name: "node_protected" });
      onProtected(res.protectionNode, res.healedNode);
      onClose();
    });
  }

  // The member's own owner may unpack it, without the container's owner.
  const handleUnpack = (memberId: string) =>
    run(t.ui.errors.unpack, async () => onUnpacked((await nodesApi.unpackNode(memberId)).node));

  async function handleToggleHidden() {
    await run(t.ui.errors.zone, async () => onUpdated(await nodesApi.setBranchHidden(node.nodeId, !node.hiddenFromMembers)));
  }

  async function handleDeleteEdge(edgeId: string) {
    try {
      await edgesApi.deleteEdge(edgeId);
      onDeleteEdge(edgeId);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.ui.errors.removeLink);
    }
  }

  const connectedEdges = edges.filter(
    (e) => nodeRefId(e.fromNodeId) === node.nodeId || nodeRefId(e.toNodeId) === node.nodeId,
  );

  const nodeById = (id: string) => nodes.find((n) => n.nodeId === id);

  const tabLabel: Record<Tab, string> = {
    info: t.map.panelTabs.info,
    // Edit/Pack/Delete, Size, Zone, Symbol, health, and the weapon/protection
    // relationship lines all live on this same "links" tab, on top of what
    // it already had — "Modify" is the label for all of that combined,
    // not just linking.
    links: t.map.panelTabs.modify,
    attack: t.map.panelTabs.attack,
    protect: t.map.panelTabs.protect,
    pack: t.map.panelTabs.packed(packedMembers.length),
    history: t.map.panelTabs.history,
  };

  return (
    <div
      ref={panelRef}
      className={tiled ? `${TILE_CLASS} ${active ? "border-2 border-accent" : "border-line"}` : PANEL_CLASS}
      data-node-panel
      data-active-panel={active ? "" : undefined}
      onPointerDownCapture={tiled && !active ? onActivate : undefined}
      // A screenshot pasted anywhere in the panel (the text field included)
      // lands on the node as a picture; pasting plain text is left alone.
      onPaste={onPanelPaste}
      style={tiled ? undefined : {
        ...(dragOffset.x || dragOffset.y ? { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` } : undefined),
        // Overrides PANEL_CLASS's own responsive max-height cap the moment
        // someone's actually resized this — see panelHeight's own doc
        // comment above. Both height and maxHeight: the sheet's content
        // (whichever tab is open) can be shorter than the chosen size, and
        // height alone wouldn't stop max-height from still capping it below
        // that on a small viewport.
        ...(panelHeight != null ? { height: panelHeight, maxHeight: panelHeight } : undefined),
      }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-1 pb-3">
      {/* Grip: the only way to drag the sheet off its dock, kept apart so the
          tabs and ✕ stay plain tap targets. touch-none stops the page scrolling. */}
      {!tiled && (
        <div
          className="-mx-5 mb-2 flex touch-none cursor-grab justify-center py-[0.35rem] select-none active:cursor-grabbing"
          onPointerDown={onGripPointerDown}
          title={t.ui.panelDragHandle}
        >
          <div className="h-[0.28rem] w-[2.5rem] rounded-full bg-line" aria-hidden />
        </div>
      )}
      {/* Type, byline and tabs share one row (wrapping on a narrow phone), so
          the node's text shows up sooner. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line pb-[0.7rem]">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex flex-shrink-0 items-center gap-[0.4rem]">
            {/* The node's type, shown, not picked: it changes from the ring of
                ghosts round the node (a ghost of another type offers "Make this
                a …") or from the node's right-click menu. */}
            <div
              className="flex items-center text-[0.68rem] font-bold tracking-[0.03em] text-ink-soft uppercase"
              title={t.ui.types[node.type]}
            >
              <NodeTypeSymbol type={node.type} size={17} />
            </div>
            {/* No title/caption here any more — the node's own text is
                still readable in the Info tab below (scrollable, full
                text), just not repeated as a header up here. */}
            <p className="m-0 text-[0.72rem] whitespace-nowrap text-ink-soft">
              {node.isWeapon ? "🏹 " : ""}
              {t.ui.node.byUser(usernameOf(node.userId as any))}
              {node.isFirstNode ? ` · ${t.ui.node.root}` : ""}
            </p>
          </div>
          {tabs.length > 1 && (
            // One Tab stop on the open tab; the arrow keys switch tabs.
            <div
              className="flex flex-wrap gap-[0.35rem]"
              role="tablist"
              aria-label={t.ui.node.tabsLabel}
              onKeyDown={(e) => {
                const to = moveRovingFocus(e, '[role="tab"]');
                if (to !== null) setTab(tabs[to]);
              }}
            >
              {tabs.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  id={`${tabIdBase}-tab-${t}`}
                  aria-selected={tab === t}
                  aria-controls={`${tabIdBase}-panel`}
                  tabIndex={tab === t ? 0 : -1}
                  className={tabBtn(tab === t)}
                  onClick={() => setTab(t)}
                >
                  {tabLabel[t]}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          {onToggleGhosts && (
            <button
              type="button"
              data-toggle-ghosts
              aria-pressed={ghostsHidden}
              className={`${closeBtn}${ghostsHidden ? " bg-surface-2" : ""}`}
              title={ghostsHidden ? t.ui.canvas.showGhosts : t.ui.canvas.hideGhosts}
              aria-label={ghostsHidden ? t.ui.canvas.showGhosts : t.ui.canvas.hideGhosts}
              onClick={onToggleGhosts}
            >
              <span className={ghostsHidden ? "opacity-40 grayscale" : ""}>👻</span>
            </button>
          )}
          <button type="button" className={closeBtn} title={t.ui.common.close} aria-label={t.ui.common.close} onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      <ErrorBanner message={error} className="mt-3" />

      <div
        id={`${tabIdBase}-panel`}
        {...(tabs.length > 1 ? { role: "tabpanel", "aria-labelledby": `${tabIdBase}-tab-${tab}` } : {})}
      >
      {tab === "info" && (
        <InfoTab
          node={node}
          isCreator={isCreator}
          busy={busy}
          cardFill={cardFill}
          feeling={feeling}
          cardLook={cardLook}
          textLocked={textLocked}
          levelLock={levelLock}
          levelProgress={levelProgress}
          onToggleLock={onToggleLock}
          onMagnet={onMagnet}
          onChangeParent={onChangeParent}
          onAutoPack={onAutoPack}
          autoPacked={autoPacked}
          onSwapWithParent={onSwapWithParent}
          onMoveToMap={onMoveToMap}
          textareaRef={textareaRef}
          readonlyTextRef={readonlyTextRef}
          textDraft={textDraft}
          setTextDraft={setTextDraft}
          expanded={expanded}
          setExpanded={setExpanded}
          textHeight={textHeight}
          copied={copied}
          templateKind={templateKind}
          onTextSave={handleTextSave}
          onSplitText={onSplitText}
          onCarryText={onCarryText}
          onStepNode={onStepNode}
          onCopyText={handleCopyText}
          onExtractText={isClusterParent ? onExtractText : undefined}
          onDelete={handleDelete}
          onTemplate={handleTemplate}
          onClose={onClose}
          pictureMap={pictureGroup && <PictureDotsMap group={pictureGroup} nodeId={node.nodeId} onSelect={onSelectNode} />}
          pictureList={pictureGroup && <PictureDotsList group={pictureGroup} nodeId={node.nodeId} onSelect={onSelectNode} />}
          imagesSection={
            <ImagesSection
              images={images}
              canEdit={isCreator}
              busy={busy}
              onAdd={(files) => void handleAddImages(files)}
              onRemove={handleRemoveImage}
              iconImage={node.iconImage}
              onSetIcon={isCreator ? (i) => setImageAs("iconImage", i) : undefined}
              cardImage={node.cardImage}
              onSetCard={isCreator ? (i) => setImageAs("cardImage", i) : undefined}
              extra={
                isCreator && !textLocked && !levelLock ? (
                  <span
                    className={`text-[0.7rem] tabular-nums ${textDraft.length >= MAX_NODE_TEXT ? "font-semibold text-danger" : "text-ink-soft"}`}
                  >
                    {textDraft.length}/{MAX_NODE_TEXT}
                  </span>
                ) : undefined
              }
            />
          }
          onDropImages={isCreator ? (files) => void handleAddImages(files) : undefined}
        />
      )}

      {tab === "links" && (
        <ModifyTab
          node={node}
          isCreator={isCreator}
          isMapOwner={isMapOwner}
          isClusterParent={isClusterParent}
          isOutcome={isOutcome}
          busy={busy}
          target={target}
          protectedTarget={protectedTarget}
          protectors={protectors}
          connectedEdges={connectedEdges}
          nodeById={nodeById}
          titleDraft={titleDraft}
          setTitleDraft={setTitleDraft}
          zoneNameDraft={zoneNameDraft}
          setZoneNameDraft={setZoneNameDraft}
          orderDraft={orderDraft}
          setOrderDraft={setOrderDraft}
          onTitleSave={handleTitleSave}
          onSetEmoji={(emoji) => void patch({ emoji }, t.ui.emoji.failed)}
          onToggleEmojiStill={() => void patch({ emojiStill: !node.emojiStill }, t.ui.emoji.failed)}
          onZoneNameSave={handleZoneNameSave}
          onOrderSave={handleOrderSave}
          onToggleHidden={handleToggleHidden}
          onSetSize={(sizeTier) => patch({ sizeTier }, t.ui.errors.size)}
          onSetZone={(manualZone) => patch({ manualZone }, t.ui.errors.zone)}
          onSetShape={(shape) => void patch({ shape }, t.ui.errors.shape)}
          onSetSymbol={(symbolOverride) => patch({ symbolOverride }, t.ui.errors.symbol)}
          onDeleteEdge={handleDeleteEdge}
          onSelectNode={onSelectNode}
          onEdit={onEdit}
          onStartPack={onStartPack}
          onStartChoose={onStartChoose}
          onClose={onClose}
        />
      )}

      {tab === "attack" && (
        <AttackTab
          node={node}
          busy={busy}
          protectors={protectors}
          attackText={attackText}
          setAttackText={setAttackText}
          attackTypes={attackTypes}
          effectiveAttackType={effectiveAttackType}
          setAttackType={setAttackType}
          attackHint={attackHint}
          strikeBackAt={strikeBack && target ? target.title || target.text || t.ui.types[target.type] : null}
          onAttack={handleAttack}
        />
      )}

      {tab === "protect" && discussionMode && (
        <ProtectTab
          node={node}
          isCreator={isCreator}
          busy={busy}
          protectText={protectText}
          setProtectText={setProtectText}
          protectType={protectType}
          setProtectType={setProtectType}
          onProtect={handleProtect}
        />
      )}

      {tab === "pack" && <PackedTab packedMembers={packedMembers} busy={busy} onUnpack={handleUnpack} />}

      {tab === "history" && <HistoryTab history={history} />}
      </div>
      </div>
      {/* Top row, pinned to the sheet's top edge: the big previous/next
          arrows at either end, right next to the canvas, and the resize
          handle between them: drag it up to give the panel (and the text
          box in it) more room, down for less (see
          panelHeight/onResizeHandlePointerDown). The handle is its own
          element so pressing an arrow never starts a resize. Comes after
          the panel's content in the markup (order-first draws it on top), so
          Tab reaches the type, the tabs, close and the open tab's content
          before these arrows. */}
      {(!tiled || onStepNode) && (
      <div className="order-first flex flex-shrink-0 items-center gap-2 px-3 pt-2">
        {onStepNode && (
          <button className={stepBtn} title={t.ui.node.prevNode} aria-label={t.ui.node.prevNode} onClick={() => onStepNode(-1, false)}>
            ←
          </button>
        )}
        {tiled ? (
          <div className="flex-1" />
        ) : (
          <div
            className="flex h-[2.75rem] flex-1 touch-none cursor-ns-resize items-center justify-center select-none"
            onPointerDown={onResizeHandlePointerDown}
            title={t.ui.panelResizeHandle}
          >
            <div className="h-[0.28rem] w-[3rem] rounded-full bg-line" aria-hidden />
          </div>
        )}
        {onStepNode && (
          <button className={stepBtn} title={t.ui.node.nextNode} aria-label={t.ui.node.nextNode} onClick={() => onStepNode(1, false)}>
            →
          </button>
        )}
      </div>
      )}
    </div>
  );
}
