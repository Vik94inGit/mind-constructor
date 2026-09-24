import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import * as nodesApi from "../api/nodes";
import * as edgesApi from "../api/edges";
import { ApiRequestError } from "../api/client";
import { allowedAttackTypes, sentimentOf, idOf, nodeRefId, usernameOf, ZONE_COLORS } from "../utils/nodeType";
import type { TemplateKind } from "../utils/templates";
import { isMobileViewport } from "../utils/canvasLayout";
import { NodeTypeIcon } from "./NodeTypeIcon";
import { ringKindFor } from "./OutcomeBadge";
import { MANUAL_ZONE_COLORS, NODE_TYPES, PROTECT_NODE_TYPES, SIZE_TIERS, WEAPONS, WEAPON_INFO } from "../types";
import type { Attack, AttackNodeType, EdgeDoc, ManualZoneColor, NodeDoc, NodeType, SizeTier, SymbolOverride, Weapon } from "../types";
import { useI18n } from "../i18n/I18nContext";

// Same 100%/115%/130% scale NodeCard's own SIZE_MULTIPLIERS uses, just for
// the button labels here — kept as a separate literal rather than imported
// from NodeCard (a map component importing from another map component's
// internals isn't a pattern this codebase otherwise uses; this pairing is
// simple enough not to be worth a shared constants file).
const SIZE_TIER_LABEL: Record<SizeTier, string> = { 1: "100%", 2: "115%", 3: "130%" };

// A bottom sheet overlaying the canvas, at every screen size — not just
// this panel's own ✕, tapping empty canvas closes it too (MapPage's own
// onClick), same as a native sheet dismisses on a tap outside it. Used to
// switch to an inline right-hand sidebar at `sm` and up; moved off that in
// favor of always keeping the canvas full-width and the node's text
// anchored to the bottom of the view, on any device.
//
// max-h caps this at roughly a third of the viewport on desktop (not the
// 75dvh this started at) — on a phone-height screen a sheet that tall left
// almost nothing for the canvas above it: the just-selected node (and its
// quick-add ghosts) routinely landed *behind* the sheet, and every other
// node in that bottom stretch became physically untappable, since the
// sheet is opaque and always paints above the canvas. Half on mobile
// instead (below Tailwind's `sm` = MapPage's own 640px isMobileViewport
// cutoff) — a phone's shorter screen needs more of it for a sheet worth
// reading, and centerOnNode still parks the chosen node in the half left
// above it. Was 2/3 (leaving only a third clear) until that turned out too
// tight for QuickAddGhosts' own ring: the node ended up sitting right
// against this sheet's edge, so the ring's own bottom half got clamped
// there and rendered invisibly underneath it (opaque, z-46, above the
// ghosts' z-33) — see panelReserveFrac's own doc comment for the full
// story. These 1/3 and 1/2 figures are shared with MapPage — see its
// own panelReserveFrac() doc comment for why they have to match:
// MapPage's centerOnNode reserves exactly this much room when parking the
// chosen node above the sheet, and viewportBounds reserves it too when
// clamping where a new node/ghost is allowed to land, so a mismatch here
// would put either of those back to guessing at how tall this sheet
// actually gets.
//
// max-h uses `dvh` (dynamic viewport height), not the plain `vh` this
// started with — on a real phone browser (address bar sliding in/out as the
// page scrolls, unlike any desktop resize or devtools device emulation)
// `vh` is defined against the *largest* the viewport could be with that
// chrome hidden, not what's actually visible right now. A `bottom-0` fixed
// sheet sized off that would size and anchor itself against space that may
// not exist on screen at that moment, landing partly or entirely off the
// visible viewport instead of the bottom this is supposed to dock to.
// `dvh` tracks the real, current visual viewport instead.
//
// z-[46]: above the minimap/zoom-controls cluster (z-[45]) on purpose — this
// panel is a full-width sheet covering the bottom of the screen anyway, so
// letting the minimap float on top of it (the old z-40, *below* z-45) just
// left a visible fragment of map poking out over the panel's own content
// instead of the panel's content actually covering it. Still below a real
// modal (Modal.tsx, z-50), which should stay on top of everything,
// this panel included.
const PANEL_CLASS =
  "fixed inset-x-0 bottom-0 z-[46] max-h-[50dvh] sm:max-h-[34dvh] w-full overflow-y-auto rounded-t-2xl border-t border-line bg-surface p-5 shadow-[var(--shadow-card)]";

// How much of the panel's own width/height must stay on screen while it's
// being dragged (see the grip handle below) — small enough to shove the
// bulk of the sheet out of the way (e.g. to uncover the bottom-left corner
// it docks over — see ZoneNames), but never so far it can be dragged
// somewhere the user can't grab it again to bring it back.
const PANEL_DRAG_MIN_VISIBLE_PX = 48;

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
  onDeleted: (nodeId: string) => void;
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
  /** True when this node is a circle's own root/parent (2+ direct parentId-children — MapPage's circleRootSentimentByNode). Gates the "Extract text" button below: the whole-map export lives in the "+" toolbar menu only, so a plain non-parent node's panel offers no text export at all. */
  isClusterParent: boolean;
  /** Asks MapPage to open a text export scoped to this node's own cluster — plus, recursively, any cluster rooted at one of its children (see MapPage's collectClusterSubtree). Only ever called when isClusterParent is true. */
  onExtractText: () => void;
}

export function NodePanel({
  node,
  nodes,
  edges,
  currentUserId,
  discussionMode,
  isMapOwner,
  onApplyTemplate,
  onClose,
  onDeleted,
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
  // Transient "Copied!" confirmation on the Info tab's own Copy button —
  // auto-clears, same pattern the mobile-focused parts of this file already
  // favor over a persistent status line for a one-off confirmation.
  const [copied, setCopied] = useState(false);
  // Relying on the textarea's native CSS resize handle (a small drag grip
  // in its own bottom-right corner) for the Info tab's own text box would
  // be easy to miss (no visible affordance beyond that grip), wouldn't
  // work via touch on most mobile browsers, and wouldn't exist at all for
  // a non-owner (their read-only view is a plain div, which CSS resize
  // doesn't apply to). This is an explicit, always-visible, works-
  // everywhere substitute instead: expanded drops
  // the box's own height cap entirely (letting it grow to fit the whole
  // text) instead of scrolling internally within a fixed 40vh — the panel
  // itself already scrolls (see PANEL_CLASS), so a long text just makes
  // the sheet itself taller/scrollable rather than needing its own nested
  // scrollbar.
  const [expanded, setExpanded] = useState(false);

  // Lets the whole sheet be dragged off its default bottom-dock, via the
  // grip handle in the JSX below — a plain translate on top of PANEL_CLASS's
  // own fixed inset-x-0 bottom-0 positioning, not a replacement for it (so
  // the sheet still opens docked at the bottom every time, same as before
  // this existed). Reset to {0,0} on every node change, same as every other
  // per-node draft in the effect below — a leftover offset from the last
  // node would otherwise make the sheet reopen already shoved out of the
  // way for a node the user never dragged it for.
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const draggingPanelRef = useRef(false);

  function onGripPointerDown(e: ReactPointerEvent) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    draggingPanelRef.current = true;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startOffset = dragOffset;
    // Bounds computed once, off the panel's own untransformed box (offsetWidth/
    // offsetHeight aren't affected by the transform this drag itself applies) —
    // a live measurement per move would be redundant work for a size that
    // never changes mid-drag.
    const panelW = panelRef.current?.offsetWidth ?? 0;
    const panelH = panelRef.current?.offsetHeight ?? 0;
    const minX = PANEL_DRAG_MIN_VISIBLE_PX - panelW;
    const maxX = window.innerWidth - PANEL_DRAG_MIN_VISIBLE_PX;
    // Base (untransformed) top is bottom-docked: window.innerHeight - panelH.
    // dy is relative to that dock, so its own bounds are expressed the same
    // way maxX/minX are for the left-anchored x axis above.
    const baseTop = window.innerHeight - panelH;
    const minY = PANEL_DRAG_MIN_VISIBLE_PX - panelH - baseTop;
    const maxY = window.innerHeight - PANEL_DRAG_MIN_VISIBLE_PX - baseTop;

    function onMove(ev: PointerEvent) {
      if (!draggingPanelRef.current) return;
      const nextX = Math.min(maxX, Math.max(minX, startOffset.x + (ev.clientX - startClientX)));
      const nextY = Math.min(maxY, Math.max(minY, startOffset.y + (ev.clientY - startClientY)));
      setDragOffset({ x: nextX, y: nextY });
    }
    function onUp() {
      draggingPanelRef.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // A <textarea>'s own rendered height is CSS/rows-driven, not content-
  // driven — removing max-height above (the `expanded` class swap) doesn't
  // by itself make the box taller, it only lifts the *cap*, same way
  // dropping a `max-width` doesn't widen an element that was never asked
  // to grow in the first place. This is the actual growing: set to its own
  // scrollHeight (the height its content would need with no scrollbar) the
  // moment expanded turns on, and again on every keystroke while it stays
  // on, so typing more keeps growing the box instead of re-introducing an
  // inner scrollbar. Collapsing clears the inline height back off entirely
  // so the CSS class's own rows/min-height takes back over, same as if
  // this effect had never touched it.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (expanded) {
      ta.style.height = "auto";
      ta.style.height = `${ta.scrollHeight}px`;
    } else {
      ta.style.height = "";
    }
  }, [expanded, textDraft]);

  // A weapon node's own targetNodeId — only ever meaningful when isWeapon,
  // surfaced as a "Points at" link in the Info tab below, and used by
  // canAttack right below to decide whether this is a retaliation.
  const targetId = node.isWeapon ? nodeRefId(node.targetNodeId) : undefined;
  const target = targetId ? nodes.find((n) => n.nodeId === targetId) : undefined;

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
  // attackAbl.ts, which enforces it); in Personal mode there is no limit.
  const attackTypes: NodeType[] = discussionMode ? allowedAttackTypes(isMapOwner, node.type) : [...NODE_TYPES];
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
  // yet (Problem or Solution: a ready structure; Fail: analyze and retry).
  const hasChildren = nodes.some((n) => nodeRefId(n.parentId) === node.nodeId);
  const templateKind: TemplateKind | null =
    !isCreator || hasChildren || node.isWeapon || node.isProtection
      ? null
      : node.type === "Problem"
        ? "problem"
        : node.type === "Solution"
          ? "goal"
          : node.type === "Fail"
            ? "retry"
            : null;
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
    "attack",
    ...(discussionMode ? (["protect"] as const) : []),
    ...(packedMembers.length > 0 ? (["pack"] as const) : []),
    "history",
  ];
  const [tab, setTab] = useState<Tab>("info");

  // Someone (the owner) flipped Discussion/Personal mode while this panel
  // was already open on the Attack or Protect tab — that tab's own button
  // just vanished from the row above (see `tabs`), so fall back to Info
  // rather than leaving `tab` pointed at a pane with no button and no
  // content (both content blocks below are gated by the same discussionMode
  // check, so it would otherwise render as a silently blank sheet).
  useEffect(() => {
    if (!discussionMode && tab === "protect") setTab("info");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discussionMode]);

  useEffect(() => {
    setError(null);
    setAttackText("");
    setAttackType("Problem");
    setProtectText("");
    setProtectType("Solution");
    setTextDraft(node.text);
    setTitleDraft(node.title ?? "");
    setZoneNameDraft(node.zoneName ?? "");
    setOrderDraft(node.order != null ? String(node.order) : "");
    setExpanded(false);
    setDragOffset({ x: 0, y: 0 });
    setTab("info");
    nodesApi
      .getAttackHistory(node.nodeId)
      .then(setHistory)
      .catch(() => setHistory([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.nodeId]);

  // Backfills textDraft once this node's real text actually arrives (see
  // MapPage's ensureNodeText/lazy text loading) — the reset-on-node-change
  // effect above only runs when node.nodeId itself changes, so it seeds
  // textDraft from whatever node.text was at the *moment this panel opened*
  // ("" for a node whose text hasn't been fetched yet), and never revisits
  // it again for this same node. Without this, opening a node before its
  // text has loaded left the textarea permanently blank even after the
  // real text landed in props a moment later. Gated on textDraft still
  // being "" so this never overwrites anything the owner's already typed
  // (or already deliberately cleared) since opening the panel — it's a
  // one-time catch-up for the lazy-load case, not a live sync with
  // whatever the node's text is right now.
  useEffect(() => {
    if (node.text !== "" && textDraft === "") setTextDraft(node.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.text]);

  // Owner-only (same as text/type edits) — a manual annotation over the
  // badge's symbol, not a rewrite of the node's own claim.
  async function handleSetSymbol(symbolOverride: SymbolOverride | null) {
    setBusy(true);
    setError(null);
    try {
      const updated = await nodesApi.updateNode(node.nodeId, { symbolOverride });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.ui.errors.symbol);
    } finally {
      setBusy(false);
    }
  }

  // Enter (no Shift) in the textarea below — same updateNode call
  // handleSetSymbol already uses, just for `text` instead of
  // `symbolOverride`. A no-op (not an error) on empty/unchanged text, same
  // as the canvas's own inline editor's resolveInlineEdit does.
  // Resolves true unless the save failed, so a caller that closes the panel
  // afterwards (Enter) can leave it open, error showing, when it did.
  async function handleTextSave(): Promise<boolean> {
    const trimmed = textDraft.trim();
    if (!trimmed || trimmed === node.text) {
      setTextDraft(node.text);
      return true;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await nodesApi.updateNode(node.nodeId, { text: trimmed });
      onUpdated(updated);
      return true;
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.ui.errors.text);
      return false;
    } finally {
      setBusy(false);
    }
  }

  // Empty is a valid save here (unlike text): it clears the title, sending
  // the canvas back to showing the start of the text. A no-op if unchanged.
  async function handleToggleHidden() {
    setBusy(true);
    setError(null);
    try {
      onUpdated(await nodesApi.setBranchHidden(node.nodeId, !node.hiddenFromMembers));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.ui.errors.zone);
    } finally {
      setBusy(false);
    }
  }

  async function handleZoneNameSave(): Promise<boolean> {
    const trimmed = zoneNameDraft.trim();
    if (trimmed === (node.zoneName ?? "")) {
      setZoneNameDraft(node.zoneName ?? "");
      return true;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await nodesApi.updateNode(node.nodeId, { zoneName: trimmed });
      onUpdated(updated);
      return true;
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.ui.errors.zone);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleTitleSave(): Promise<boolean> {
    const trimmed = titleDraft.trim();
    if (trimmed === (node.title ?? "")) {
      setTitleDraft(node.title ?? "");
      return true;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await nodesApi.updateNode(node.nodeId, { title: trimmed });
      onUpdated(updated);
      return true;
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.ui.errors.title);
      return false;
    } finally {
      setBusy(false);
    }
  }

  // A blank field clears the step number; anything else has to be a whole
  // number from 1 to 9999 (the backend's own bounds). No-op if unchanged.
  async function handleOrderSave(): Promise<boolean> {
    const trimmed = orderDraft.trim();
    const current = node.order ?? null;
    const next = trimmed === "" ? null : Number(trimmed);
    if (next !== null && (!Number.isInteger(next) || next < 1 || next > 9999)) {
      setError(t.ui.errors.order);
      setOrderDraft(current !== null ? String(current) : "");
      return false;
    }
    if (next === current) return true;
    setBusy(true);
    setError(null);
    try {
      const updated = await nodesApi.updateNode(node.nodeId, { order: next });
      onUpdated(updated);
      return true;
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.ui.errors.order);
      return false;
    } finally {
      setBusy(false);
    }
  }

  // Copies the node's own real text (not textDraft — this should work
  // identically for a non-owner, who has no draft at all) to the clipboard.
  // Everyone can do this, not just the owner — reading/reusing a node's
  // text isn't an edit.
  async function handleCopyText() {
    try {
      await navigator.clipboard.writeText(node.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(t.ui.errors.clipboard);
    }
  }

  async function handleDelete() {
    if (!confirm(t.ui.node.deleteConfirm)) return;
    setBusy(true);
    try {
      const res = await nodesApi.deleteNode(node.nodeId);
      onDeleted(node.nodeId);
      // Deleting a protection node with banked damage releases the whole
      // total onto whatever it was defending in the same breath — see
      // Backend's deleteNodeDao. Surface that update the same way any
      // other panel-triggered change does.
      if (res.damagedProtectedNode) onUpdated(res.damagedProtectedNode);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.ui.errors.delete);
    } finally {
      setBusy(false);
    }
  }

  async function handleTemplate(kind: TemplateKind) {
    setBusy(true);
    setError(null);
    try {
      await onApplyTemplate(kind);
      onClose();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.ui.templates.failed);
    } finally {
      setBusy(false);
    }
  }

  async function handleAttack(weapon: Weapon) {
    if (!attackText.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await nodesApi.attackNode(node.nodeId, weapon, { type: effectiveAttackType, text: attackText.trim() });
      onAttacked(res.node, res.weaponNode, weapon, res.healedParent, res.blocked, res.protector);
      // Landing an attack — blocked or not — creates a real node (the
      // weapon node carrying the attacker's own objection); closing here
      // matches every other node-creating action in this panel (Protect
      // below, Pack's own confirm in MapPage) instead of leaving the panel
      // sitting open on whatever was just acted on.
      onClose();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.ui.errors.attack);
    } finally {
      setBusy(false);
    }
  }

  // Owner-of-the-*target*-only (protectNodeAbl enforces this server-side
  // too) — creates a protection node aimed at this node.
  async function handleProtect() {
    if (!protectText.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await nodesApi.protectNode(node.nodeId, { type: protectType, text: protectText.trim() });
      onProtected(res.protectionNode, res.healedNode);
      // Same "close after creating a node" reasoning as handleAttack above.
      onClose();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.ui.errors.protect);
    } finally {
      setBusy(false);
    }
  }

  // Owner-of-the-*member*-only (unpackNodeAbl enforces this server-side
  // too) — a member unpacking itself back out doesn't require the
  // container's own owner at all, same as any other single-node edit.
  async function handleUnpack(memberId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await nodesApi.unpackNode(memberId);
      onUnpacked(res.node);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.ui.errors.unpack);
    } finally {
      setBusy(false);
    }
  }

  // Owner-only (same as text/type edits) — packAbl.ts's own auto-bump is
  // the common path to a non-1 size; this is the manual override. Reset
  // pins at tier 1 explicitly rather than clearing back to "untouched," so
  // it can never silently re-bump on a later pack — see Node.sizeTier's own
  // doc comment.
  async function handleSetSize(tier: SizeTier) {
    setBusy(true);
    setError(null);
    try {
      const updated = await nodesApi.updateNode(node.nodeId, { sizeTier: tier });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.ui.errors.size);
    } finally {
      setBusy(false);
    }
  }

  // Owner-only — the type itself, not to be confused with symbolOverride
  // (which only ever tweaks an outcome node's inner check/cross, never its
  // actual claimed type). The canvas's own inline editor (double-click, or
  // the Edit button below) already lets you cycle through types by
  // clicking the node's icon — this is a second, more discoverable path to
  // the exact same field, same reasoning Size/Zone/Symbol already got
  // their own explicit controls here instead of staying inline-editor-only.
  async function handleSetType(type: NodeType) {
    if (type === node.type) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await nodesApi.updateNode(node.nodeId, { type });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.ui.errors.type);
    } finally {
      setBusy(false);
    }
  }

  // Owner-only (same as text/type edits) — a manually-chosen zone ring
  // around just this node, independent of the automatic circle/nodeGroups
  // detection. null explicitly removes it, same nullish contract
  // symbolOverride already uses.
  async function handleSetZone(manualZone: ManualZoneColor | null) {
    setBusy(true);
    setError(null);
    try {
      const updated = await nodesApi.updateNode(node.nodeId, { manualZone });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.ui.errors.zone);
    } finally {
      setBusy(false);
    }
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
      className={PANEL_CLASS}
      style={dragOffset.x || dragOffset.y ? { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` } : undefined}
    >
      {/* Grip handle — the only way to drag this sheet off its default
          bottom dock (see dragOffset/onGripPointerDown above). A dedicated
          strip rather than making the whole header draggable, so the tab
          buttons and ✕ right below it stay plain clickable/tappable targets
          instead of every pointerdown on them being swallowed as a drag
          attempt. touch-none: without it a touch-drag here scrolls/bounces
          the page underneath instead of moving the sheet. */}
      <div
        className="-mx-5 -mt-5 mb-3 flex touch-none cursor-grab justify-center py-[0.35rem] select-none active:cursor-grabbing"
        onPointerDown={onGripPointerDown}
        title={t.ui.panelDragHandle}
      >
        <div className="h-[0.28rem] w-[2.5rem] rounded-full bg-line" aria-hidden />
      </div>
      {/* Type/byline and the tabs now share one row instead of stacking as
          two — freeing up a whole row of this panel's own limited height
          (capped at 34dvh/50dvh — see PANEL_CLASS) means the actual node
          text (the Info tab's content, or whichever tab is open) shows up
          a beat sooner, closer to "at a glance" instead of behind a header
          that was mostly just chrome. flex-wrap: on a narrow phone with
          every tab present (Attack/Protect/Pack/History all at once) this
          can still wrap to a second line — the tabs themselves already
          handle that gracefully (see their own flex-wrap), this just lets
          the icon/byline join that same wrap instead of always claiming a
          fixed-height row of their own. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line pb-[0.7rem]">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex flex-shrink-0 items-center gap-[0.4rem]">
            <div
              className="flex items-center text-[0.68rem] font-bold tracking-[0.03em] text-ink-soft uppercase"
              title={t.ui.types[node.type]}
            >
              <NodeTypeIcon type={node.type} />
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
            <div className="flex flex-wrap gap-[0.35rem]">
              {tabs.map((t) => (
                <button key={t} className={tabBtn(tab === t)} onClick={() => setTab(t)}>
                  {tabLabel[t]}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className={closeBtn} onClick={onClose}>
          ✕
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{error}</div>
      )}

      {tab === "info" && (
        <div className="mt-4">
          {/* Just the text — extendable (a generous min-height so even a
              short claim doesn't look cramped) and scrollable (capped at
              max-h so a long one scrolls in place instead of pushing the
              rest of the sheet, and this whole panel, off-screen, unless
              expanded — see the Expand/Collapse button below, and its own
              doc comment on the `expanded` state above for why that's a
              real button now rather than just this box's native CSS
              resize handle). Owner gets the same editable textarea
              NodePanel has always used here (Enter/blur-to-save, mobile's
              own Enter-inserts-a-newline handling below, unchanged);
              anyone else gets a plain read-only, same-sized block —
              reading a node's full text shouldn't require owning it. */}
          {/* The node's title, when it has one — read-only here for
              everyone; the owner edits it under Modify. */}
          {node.title && <div className="mb-2 text-[0.95rem] font-semibold text-ink">{node.title}</div>}
          {isCreator ? (
            <textarea
              id="node-text"
              ref={textareaRef}
              rows={6}
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              disabled={busy}
              onKeyDown={(e) => {
                // Mobile has no Shift key to reach alongside a virtual
                // keyboard's Enter/return, so plain Enter has to behave
                // like a normal textarea there too (insert a newline,
                // "another row," same as Shift+Enter below) — saving is
                // onBlur's job only (tapping the visible strip of canvas
                // outside the panel already does this). Desktop keeps its
                // existing plain-Enter-saves shortcut, Shift+Enter still
                // its own newline escape hatch.
                if (e.key === "Enter" && !e.shiftKey && !isMobileViewport()) {
                  e.preventDefault();
                  // Saves, then closes the panel — editing is done.
                  void handleTextSave().then((ok) => ok && onClose());
                }
                // Shift+Enter (desktop), or plain Enter on mobile: no
                // preventDefault — the textarea's own default behavior
                // (insert a newline) is exactly what's wanted here.
              }}
              onBlur={() => void handleTextSave()}
              className={`min-h-[8rem] w-full resize-y rounded-lg border border-line bg-surface px-[0.7rem] py-[0.55rem] text-[0.88rem] leading-relaxed font-[inherit] text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent ${expanded ? "max-h-none" : "max-h-[40vh]"}`}
            />
          ) : (
            <div
              className={`min-h-[8rem] w-full overflow-y-auto rounded-lg border border-line bg-surface-2 px-[0.7rem] py-[0.55rem] text-[0.88rem] leading-relaxed whitespace-pre-wrap text-ink ${expanded ? "max-h-none" : "max-h-[40vh]"}`}
            >
              {node.text}
            </div>
          )}
          <div className="mt-2 flex items-center gap-[0.5rem]">
            <button
              className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? t.ui.node.collapseTitle : t.ui.node.expandTitle}
            >
              {expanded ? t.ui.node.collapse : t.ui.node.expand}
            </button>
            {isCreator && (
              <button
                className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => textareaRef.current?.focus()}
              >
                {t.ui.common.edit}
              </button>
            )}
            <button
              className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleCopyText}
            >
              {copied ? t.ui.common.copied : t.ui.common.copy}
            </button>
            {isCreator && (
              <button
                className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-danger-bg bg-danger-bg px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-danger transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleDelete}
                disabled={busy}
              >
                {t.ui.common.delete}
              </button>
            )}
          </div>
        {templateKind && (
          <div className="mt-4 rounded-lg border border-line bg-surface-2 p-3">
            <div className="text-[0.78rem] font-semibold text-ink-soft">
              {templateKind === "retry" ? t.ui.templates.retry.title : t.ui.templates.section}
            </div>
            <p className="mt-1 text-[0.78rem] text-ink-soft">
              {templateKind === "problem"
                ? t.ui.templates.problem.hint
                : templateKind === "goal"
                  ? t.ui.templates.goal.hint
                  : t.ui.templates.retry.hint}
            </p>
            <button
              type="button"
              className="mt-2 inline-flex cursor-pointer items-center rounded-lg border border-accent bg-accent-soft px-3 py-[0.4rem] text-[0.85rem] font-semibold text-accent-ink disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy}
              onClick={() => handleTemplate(templateKind)}
            >
              {templateKind === "problem"
                ? t.ui.templates.problem.button
                : templateKind === "goal"
                  ? t.ui.templates.goal.button
                  : t.ui.templates.retry.button}
            </button>
          </div>
        )}
        </div>
      )}

      {tab === "links" && (
        <div className="mt-4">
          <div className="h-1 overflow-hidden rounded-[3px] bg-surface-2">
            <div
              className="h-full transition-[width] duration-200"
              style={{
                width: `${Math.max(0, node.health)}%`,
                background: node.defeated ? "var(--danger)" : "var(--success)",
              }}
            />
          </div>
          <p style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
            {t.ui.node.healthLine(node.health, node.defeated)}
          </p>

          {node.isWeapon && target && (
            <p style={{ fontSize: "0.8rem", marginTop: "0.4rem" }}>
              {t.ui.node.pointsAt}{" "}
              <a role="button" style={{ cursor: "pointer" }} onClick={() => onSelectNode(target.nodeId)}>
                {target.text.slice(0, 40)}
              </a>
            </p>
          )}

          {node.isProtection && protectedTarget && (
            <p style={{ fontSize: "0.8rem", marginTop: "0.4rem" }}>
              🛡️ {t.ui.node.protects}{" "}
              <a role="button" style={{ cursor: "pointer" }} onClick={() => onSelectNode(protectedTarget.nodeId)}>
                {protectedTarget.text.slice(0, 40)}
              </a>
            </p>
          )}

          {node.isProtection && !!node.blockedDamage && (
            <p style={{ fontSize: "0.78rem", marginTop: "0.3rem", color: "var(--ink-soft)" }}>
              {t.ui.node.blocked(node.blockedDamage, protectedTarget ? protectedTarget.text.slice(0, 30) : null)}
            </p>
          )}

          {protectors.length > 0 && (
            <p style={{ fontSize: "0.8rem", marginTop: "0.4rem" }}>
              🛡️ {t.ui.node.protectedBy}{" "}
              {protectors.map((p, i) => (
                <span key={p.nodeId}>
                  {i > 0 && ", "}
                  <a role="button" style={{ cursor: "pointer" }} onClick={() => onSelectNode(p.nodeId)}>
                    {p.text.slice(0, 24)}
                  </a>
                </span>
              ))}
            </p>
          )}

          {/* Optional title — what the canvas shows under the node instead of
              the start of the text. Saves on blur/Enter. */}
          {isCreator && (
            <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem", alignItems: "center" }}>
              <label htmlFor="node-title" style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
                {t.ui.node.title}
              </label>
              <input
                id="node-title"
                type="text"
                maxLength={80}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                disabled={busy}
                placeholder={t.ui.node.titlePlaceholder}
                onKeyDown={(e) => {
                  // Enter saves, then closes the panel — editing is done.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleTitleSave().then((ok) => ok && onClose());
                  }
                }}
                onBlur={() => void handleTitleSave()}
                className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-[0.7rem] py-[0.35rem] text-[0.85rem] font-[inherit] text-ink placeholder:text-ink-soft focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          )}

          {/* Name of the zone this node is the parent of — shown under it on
              the canvas and on the minimap. Saves on blur/Enter. */}
          {isCreator && isClusterParent && (
            <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem", alignItems: "center" }}>
              <label htmlFor="node-zone-name" style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
                {t.ui.node.zoneName}
              </label>
              <input
                id="node-zone-name"
                type="text"
                maxLength={40}
                value={zoneNameDraft}
                onChange={(e) => setZoneNameDraft(e.target.value)}
                disabled={busy}
                placeholder={t.ui.node.zoneNamePlaceholder}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleZoneNameSave().then((ok) => ok && onClose());
                  }
                }}
                onBlur={() => void handleZoneNameSave()}
                className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-[0.7rem] py-[0.35rem] text-[0.85rem] font-[inherit] text-ink placeholder:text-ink-soft focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          )}

          {/* The map owner can hide this whole branch from invited members. */}
          {isMapOwner && (
            <div className="mt-[0.6rem]">
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={busy}
                onClick={() => void handleToggleHidden()}
              >
                {node.hiddenFromMembers ? t.ui.visibility.show : t.ui.visibility.hide}
              </button>
              <p className="mt-1 text-[0.72rem] text-ink-soft">{t.ui.visibility.hint}</p>
            </div>
          )}

          {/* Optional step number — a badge on the node, for describing a
              process by labeling nodes 1, 2, 3… Blank clears it. */}
          {isCreator && (
            <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem", alignItems: "center" }}>
              <label htmlFor="node-order" style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
                {t.ui.node.order}
              </label>
              <input
                id="node-order"
                type="number"
                inputMode="numeric"
                min={1}
                max={9999}
                step={1}
                value={orderDraft}
                onChange={(e) => setOrderDraft(e.target.value)}
                disabled={busy}
                placeholder={t.ui.node.orderPlaceholder}
                title={t.ui.node.orderTitle}
                onKeyDown={(e) => {
                  // Enter saves, then closes the panel — same as the title.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleOrderSave().then((ok) => ok && onClose());
                  }
                }}
                onBlur={() => void handleOrderSave()}
                className="w-24 rounded-lg border border-line bg-surface px-[0.7rem] py-[0.35rem] text-[0.85rem] font-[inherit] text-ink placeholder:text-ink-soft focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          )}

          {isCreator && (
            <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>{t.ui.node.type}</span>
              <select
                value={node.type}
                onChange={(e) => handleSetType(e.target.value as NodeType)}
                disabled={busy}
                className="rounded-lg border border-line bg-surface px-[0.55rem] py-[0.3rem] text-[0.8rem] font-[inherit] text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {NODE_TYPES.map((ty) => (
                  <option key={ty} value={ty}>
                    {t.ui.types[ty]}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isCreator && (
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
              <button
                className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onEdit}
                title={t.ui.node.editTitle}
              >
                {t.ui.node.edit}
              </button>
              <button
                className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onStartPack}
                title={t.ui.node.packTitle}
              >
                {t.ui.node.pack}
              </button>
            </div>
          )}

          {isCreator && (
            <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>{t.ui.node.size}</span>
              {SIZE_TIERS.map((tier) => (
                <button
                  key={tier}
                  className={`inline-flex cursor-pointer items-center justify-center rounded-lg border px-[0.55rem] py-[0.3rem] text-[0.8rem] font-semibold transition-[background-color,border-color,opacity] duration-[120ms] disabled:cursor-not-allowed disabled:opacity-50 ${
                    (node.sizeTier ?? 1) === tier
                      ? "border-accent bg-accent-soft text-accent-ink"
                      : "border-line bg-surface text-ink enabled:hover:bg-surface-2"
                  }`}
                  onClick={() => handleSetSize(tier)}
                  disabled={busy}
                >
                  {SIZE_TIER_LABEL[tier]}
                </button>
              ))}
            </div>
          )}

          {isCreator && (
            <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>{t.ui.node.zone}</span>
              {MANUAL_ZONE_COLORS.map((z) => (
                <button
                  key={z}
                  className="inline-flex cursor-pointer items-center justify-center rounded-lg border px-[0.55rem] py-[0.3rem] text-[0.8rem] font-semibold capitalize transition-[background-color,border-color,opacity] duration-[120ms] disabled:cursor-not-allowed disabled:opacity-50"
                  style={
                    node.manualZone === z
                      ? {
                          borderColor: ZONE_COLORS[z],
                          // ZONE_COLORS is now a var(--zone-...) reference
                          // (see its own doc comment), not a bare hex
                          // literal — can't just append a hex alpha suffix
                          // to it like "26" any more, so color-mix does the
                          // same ~15% tint instead.
                          background: `color-mix(in srgb, ${ZONE_COLORS[z]} 15%, transparent)`,
                          color: ZONE_COLORS[z],
                        }
                      : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }
                  }
                  onClick={() => handleSetZone(z)}
                  disabled={busy}
                  title={t.ui.node.zoneTitle(z)}
                >
                  {t.ui.sentiments[z]}
                </button>
              ))}
              {node.manualZone && (
                <button
                  className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-transparent bg-transparent px-[0.55rem] py-[0.3rem] text-[0.78rem] font-semibold text-ink-soft transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => handleSetZone(null)}
                  disabled={busy}
                  title={t.ui.node.zoneRemoveTitle}
                >
                  {t.ui.node.reset}
                </button>
              )}
            </div>
          )}

          {isCreator && isOutcome && (
            <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>{t.ui.node.symbol}</span>
              <button
                className={`inline-flex cursor-pointer items-center justify-center rounded-lg border px-[0.55rem] py-[0.3rem] text-[0.85rem] font-semibold transition-[background-color,border-color,opacity] duration-[120ms] disabled:cursor-not-allowed disabled:opacity-50 ${
                  node.symbolOverride === "check"
                    ? "border-accent bg-accent-soft text-accent-ink"
                    : "border-line bg-surface text-ink enabled:hover:bg-surface-2"
                }`}
                onClick={() => handleSetSymbol("check")}
                disabled={busy}
                title={t.ui.node.symbolCheckTitle}
              >
                ✓
              </button>
              <button
                className={`inline-flex cursor-pointer items-center justify-center rounded-lg border px-[0.55rem] py-[0.3rem] text-[0.85rem] font-semibold transition-[background-color,border-color,opacity] duration-[120ms] disabled:cursor-not-allowed disabled:opacity-50 ${
                  node.symbolOverride === "cross"
                    ? "border-accent bg-accent-soft text-accent-ink"
                    : "border-line bg-surface text-ink enabled:hover:bg-surface-2"
                }`}
                onClick={() => handleSetSymbol("cross")}
                disabled={busy}
                title={t.ui.node.symbolCrossTitle}
              >
                ✗
              </button>
              {node.symbolOverride && (
                <button
                  className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-transparent bg-transparent px-[0.55rem] py-[0.3rem] text-[0.78rem] font-semibold text-ink-soft transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => handleSetSymbol(null)}
                  disabled={busy}
                  title={t.ui.node.symbolResetTitle}
                >
                  {t.ui.node.reset}
                </button>
              )}
            </div>
          )}

          {isCreator && (
            <div className="mt-4 border-t border-line pt-4">
              <button
                className="inline-flex w-full cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onStartChoose}
                title={t.ui.node.chooseNodesTitle}
              >
                {t.ui.node.chooseNodes}
              </button>
            </div>
          )}
          {connectedEdges.length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)", marginTop: "0.5rem" }}>{t.ui.node.noLinks}</p>
          ) : (
            <div style={{ marginTop: "0.5rem" }}>
              {connectedEdges.map((e) => {
                const fromId = nodeRefId(e.fromNodeId)!;
                const toId = nodeRefId(e.toNodeId)!;
                const otherId = fromId === node.nodeId ? toId : fromId;
                const other = nodeById(otherId);
                const dir = fromId === node.nodeId ? "→" : "←";
                return (
                  <div className="flex items-center justify-between py-[0.35rem] text-[0.8rem]" key={e.edgeId}>
                    <span>
                      <span
                        className="inline-flex items-center gap-1 rounded-[20px] border border-line bg-surface-2 px-[0.55rem] py-[0.2rem] text-[0.72rem] text-ink-soft"
                        style={{
                          color:
                            e.sentiment === "negative"
                              ? "var(--danger)"
                              : e.sentiment === "positive"
                                ? "var(--success)"
                                : "var(--ink-soft)",
                        }}
                      >
                        {t.ui.sentiments[e.sentiment]}
                      </span>{" "}
                      {dir} {other ? other.text.slice(0, 24) : "…"}
                    </span>
                    <button
                      className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-transparent bg-transparent px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => handleDeleteEdge(e.edgeId)}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {isClusterParent && (
            <div className="mt-4 border-t border-line pt-4">
              <button
                className="inline-flex w-full cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onExtractText}
                title={t.ui.node.extractTextTitle}
              >
                {t.ui.node.extractText}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "attack" && (
        <div className="mt-4">
          <p style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
            {t.ui.attack.intro}
            {node.isWeapon && t.ui.attack.introWeapon}
            {protectors.length > 0 && t.ui.attack.introShielded}
          </p>
          <div className="mb-4 flex flex-col gap-[0.35rem]">
            <label htmlFor="attack-text" className="text-[0.8rem] font-semibold text-ink-soft">
              {t.ui.attack.objection}
            </label>
            <textarea
              id="attack-text"
              rows={2}
              value={attackText}
              onChange={(e) => setAttackText(e.target.value)}
              placeholder={t.ui.attack.placeholder}
              className="rounded-lg border border-line bg-surface px-[0.7rem] py-[0.55rem] text-[0.92rem] font-[inherit] text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent"
            />
          </div>
          <div className="mb-4 flex flex-col gap-[0.35rem]">
            <label htmlFor="attack-type" className="text-[0.8rem] font-semibold text-ink-soft">
              {t.ui.attack.as}
            </label>
            <select
              id="attack-type"
              value={effectiveAttackType}
              onChange={(e) => setAttackType(e.target.value as NodeType)}
              className="rounded-lg border border-line bg-surface px-[0.7rem] py-[0.55rem] text-[0.92rem] font-[inherit] text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent"
            >
              {attackTypes.map((ty) => (
                <option key={ty} value={ty}>
                  {t.ui.types[ty]}
                </option>
              ))}
            </select>
            {attackHint && <p className="text-[0.75rem] text-ink-soft">{attackHint}</p>}
          </div>
          {!attackText.trim() && (
            <p style={{ fontSize: "0.78rem", color: "var(--accent)", fontWeight: 600 }}>
              {t.ui.attack.writeObjection}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {WEAPONS.map((w) => {
              const info = WEAPON_INFO[w];
              const needsText = !attackText.trim();
              return (
                <button
                  key={w}
                  className="inline-flex w-full cursor-pointer items-center justify-between gap-[0.4rem] rounded-lg border border-line bg-surface px-4 py-[0.55rem] text-[0.88rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={busy || needsText}
                  title={needsText ? t.ui.attack.writeFirst : undefined}
                  onClick={() => handleAttack(w)}
                >
                  <span>
                    {t.ui.attack.weapons[w]} (-{info.damage})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab === "protect" && discussionMode && (
        <div className="mt-4">
          {isCreator ? (
            <>
              <p style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
                {t.ui.protect.intro}
              </p>
              <div className="mb-4 flex flex-col gap-[0.35rem]">
                <label htmlFor="protect-text" className="text-[0.8rem] font-semibold text-ink-soft">
                  {t.ui.protect.why}
                </label>
                <textarea
                  id="protect-text"
                  rows={2}
                  value={protectText}
                  onChange={(e) => setProtectText(e.target.value)}
                  placeholder={t.ui.protect.placeholder}
                  className="rounded-lg border border-line bg-surface px-[0.7rem] py-[0.55rem] text-[0.92rem] font-[inherit] text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent"
                />
              </div>
              <div className="mb-4 flex flex-col gap-[0.35rem]">
                <label htmlFor="protect-type" className="text-[0.8rem] font-semibold text-ink-soft">
                  {t.ui.protect.as}
                </label>
                <select
                  id="protect-type"
                  value={protectType}
                  onChange={(e) => setProtectType(e.target.value as AttackNodeType)}
                  className="rounded-lg border border-line bg-surface px-[0.7rem] py-[0.55rem] text-[0.92rem] font-[inherit] text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent"
                >
                  {PROTECT_NODE_TYPES.map((ty) => (
                    <option key={ty} value={ty}>
                      {t.ui.types[ty]}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="inline-flex w-full cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-accent bg-accent px-[0.65rem] py-[0.55rem] text-[0.88rem] font-semibold text-white transition-opacity duration-[120ms] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={busy || !protectText.trim()}
                title={!protectText.trim() ? t.ui.protect.writeFirst : undefined}
                onClick={handleProtect}
              >
                🛡️ {t.ui.protect.add}
              </button>
            </>
          ) : (
            <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
              {t.ui.protect.onlyOwner(usernameOf(node.userId as any))}
            </p>
          )}
        </div>
      )}

      {tab === "pack" && (
        <div className="mt-4">
          {packedMembers.length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>{t.ui.packed.empty}</p>
          ) : (
            <div style={{ marginTop: "0.5rem" }}>
              {packedMembers.map((m) => (
                <div className="flex items-center justify-between py-[0.35rem] text-[0.8rem]" key={m.nodeId}>
                  <span className="min-w-0 truncate">{m.text.slice(0, 40)}</span>
                  <button
                    className="inline-flex flex-shrink-0 cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.55rem] py-[0.25rem] text-[0.76rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => handleUnpack(m.nodeId)}
                    disabled={busy}
                  >
                    {t.ui.packed.unpack}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="mt-4">
          {history === null ? (
            <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>{t.ui.history.loading}</p>
          ) : history.length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>{t.ui.history.none}</p>
          ) : (
            history.map((a, i) => (
              <div className="flex justify-between border-b border-line py-[0.4rem] text-[0.8rem] last:border-b-0" key={i}>
                <span>
                  {usernameOf(a.attackerId as any)} · {t.ui.attack.weapons[a.weapon]}
                </span>
                <span>-{a.damage}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
