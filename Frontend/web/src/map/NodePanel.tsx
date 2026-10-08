import { useEffect, useRef, useState } from "react";
import * as nodesApi from "../api/nodes";
import * as edgesApi from "../api/edges";
import { ApiRequestError } from "../api/client";
import { allowedAttackTypes, sentimentOf, idOf, nodeRefId, usernameOf } from "../utils/nodeType";
import type { TemplateKind } from "../utils/templates";
import { NodeTypeIcon } from "./NodeTypeIcon";
import { ringKindFor } from "./OutcomeBadge";
import { NODE_TYPES } from "../types";
import type { Attack, AttackNodeType, EdgeDoc, ManualZoneColor, NodeDoc, NodeType, SizeTier, SymbolOverride, Weapon } from "../types";
import { useI18n } from "../i18n/I18nContext";
import { usePanelSheet } from "./nodePanel/usePanelSheet";
import { InfoTab } from "./nodePanel/InfoTab";
import { ModifyTab } from "./nodePanel/ModifyTab";
import { AttackTab } from "./nodePanel/AttackTab";
import { ProtectTab } from "./nodePanel/ProtectTab";
import { PackedTab } from "./nodePanel/PackedTab";
import { HistoryTab } from "./nodePanel/HistoryTab";
import { ImagesSection } from "./nodePanel/ImagesSection";
import { MAX_NODE_TEXT } from "../utils/nodeText";
import { MAX_NODE_IMAGES, imageFilesFrom, shrinkImage } from "../utils/images";

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
  /** Set while this node is drawn as a puzzle card: its fill (the viewer's own, see utils/cardFill.ts) and how to change it. */
  cardFill?: { value: string | undefined; onChange: (color: string | null) => void } | null;
  /** Its owner locked this text block (utils/blockLock.ts): the text reads as for anyone else's node until unlocked. */
  textLocked?: boolean;
  /** Locks/unlocks this node — owner only. */
  onToggleLock?: () => void;
  /** Set right after this node was created: open on its text, focused, ready to write more. Fired back through onAutoFocused once done. */
  autoFocusText?: boolean;
  onAutoFocused?: () => void;
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
  cardFill,
  textLocked = false,
  onToggleLock,
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

  // The node's pictures. The map's node list leaves them out (like text), so
  // unless this node already carries them (it was just edited here, or came
  // in over the socket) they're fetched with the single node on open. null
  // while that fetch is in flight.
  const [images, setImages] = useState<string[] | null>(node.images ?? null);
  useEffect(() => {
    if (node.images) {
      setImages(node.images);
      return;
    }
    let cancelled = false;
    setImages(null);
    nodesApi
      .getNode(node.nodeId)
      .then((full) => !cancelled && setImages(full.images ?? []))
      .catch(() => !cancelled && setImages([]));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.nodeId]);
  useEffect(() => {
    if (node.images) setImages(node.images);
  }, [node.images]);

  // Dragging the sheet off its bottom dock and resizing it — see
  // usePanelSheet.
  const { panelRef, dragOffset, setDragOffset, panelHeight, textHeight, onResizeHandlePointerDown, onGripPointerDown } =
    usePanelSheet({ textareaRef, readonlyTextRef });

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

  // A <textarea>'s own rendered height is CSS/rows-driven, not content-
  // driven — removing max-height above (the `expanded` class swap) doesn't
  // by itself make the box taller, it only lifts the *cap*, same way
  // dropping a `max-width` doesn't widen an element that was never asked
  // to grow in the first place. This is the actual growing: set to its own
  // scrollHeight (the height its content would need with no scrollbar) the
  // moment expanded turns on, and again on every keystroke while it stays
  // on, so typing more keeps growing the box instead of re-introducing an
  // inner scrollbar. Collapsing goes back to the height the panel resize
  // gave it, or clears the inline height so the CSS class's own
  // rows/min-height takes back over.
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

  // Owner-only, like every node edit. Each picture is shrunk first (see
  // utils/images.ts); the whole list is then saved in one PATCH.
  async function saveImages(next: string[]) {
    const updated = await nodesApi.updateNode(node.nodeId, { images: next });
    setImages(updated.images ?? next);
    onUpdated(updated);
  }

  async function handleAddImages(files: File[]) {
    if (!isCreator || images === null) return;
    const room = MAX_NODE_IMAGES - images.length;
    if (room <= 0) {
      setError(t.ui.images.limit(MAX_NODE_IMAGES));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const added: string[] = [];
      for (const file of files.slice(0, room)) {
        try {
          added.push(await shrinkImage(file));
        } catch {
          setError(t.ui.images.tooLarge);
        }
      }
      if (files.length > room) setError(t.ui.images.limit(MAX_NODE_IMAGES));
      if (added.length) await saveImages([...images, ...added]);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.ui.images.failed);
    } finally {
      setBusy(false);
    }
  }

  // A screenshot pasted while this panel is open lands on the node even when
  // nothing in the panel has focus (the usual case: a node was just clicked
  // on the canvas). A paste inside the panel is already handled by its own
  // onPaste below, and one into some other text field is left to it.
  const addImagesRef = useRef(handleAddImages);
  addImagesRef.current = handleAddImages;
  useEffect(() => {
    if (!isCreator) return;
    function onDocumentPaste(e: ClipboardEvent) {
      if (e.defaultPrevented) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const files = imageFilesFrom(e.clipboardData);
      if (files.length === 0) return;
      e.preventDefault();
      setTab("info");
      void addImagesRef.current(files);
    }
    document.addEventListener("paste", onDocumentPaste);
    return () => document.removeEventListener("paste", onDocumentPaste);
  }, [isCreator]);

  async function handleRemoveImage(index: number) {
    if (!isCreator || images === null) return;
    setBusy(true);
    setError(null);
    try {
      await saveImages(images.filter((_, i) => i !== index));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.ui.images.failed);
    } finally {
      setBusy(false);
    }
  }

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

  // Owner-only, like every node edit — "" removes the emoji.
  async function handleSetEmoji(emoji: string) {
    setBusy(true);
    setError(null);
    try {
      onUpdated(await nodesApi.updateNode(node.nodeId, { emoji }));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.ui.emoji.failed);
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
      // A screenshot pasted anywhere in the panel (the text field included)
      // lands on the node as a picture; pasting plain text is left alone.
      onPaste={(e) => {
        if (!isCreator) return;
        const files = imageFilesFrom(e.clipboardData);
        if (files.length === 0) return;
        e.preventDefault();
        setTab("info");
        void handleAddImages(files);
      }}
      style={{
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
      {/* Resize handle — drags the sheet's top edge to grow/shrink it (see
          panelHeight/onResizeHandlePointerDown above). Separate from the
          grip below (which repositions the whole sheet instead) so the two
          gestures never fight over the same strip. Same bleed-to-the-edge
          technique the grip already uses, just for height instead of
          reach. */}
      <div
        className="-mx-5 -mt-5 mb-[0.15rem] h-[0.6rem] touch-none cursor-ns-resize select-none"
        onPointerDown={onResizeHandlePointerDown}
        title={t.ui.panelResizeHandle}
      />
      {/* Grip handle — the only way to drag this sheet off its default
          bottom dock (see dragOffset/onGripPointerDown above). A dedicated
          strip rather than making the whole header draggable, so the tab
          buttons and ✕ right below it stay plain clickable/tappable targets
          instead of every pointerdown on them being swallowed as a drag
          attempt. touch-none: without it a touch-drag here scrolls/bounces
          the page underneath instead of moving the sheet. */}
      <div
        className="-mx-5 mb-3 flex touch-none cursor-grab justify-center py-[0.35rem] select-none active:cursor-grabbing"
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
        <InfoTab
          node={node}
          isCreator={isCreator}
          busy={busy}
          cardFill={cardFill}
          textLocked={textLocked}
          onToggleLock={onToggleLock}
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
          onCopyText={handleCopyText}
          onDelete={handleDelete}
          onTemplate={handleTemplate}
          onClose={onClose}
          imagesSection={
            <ImagesSection
              images={images}
              canEdit={isCreator}
              busy={busy}
              onAdd={(files) => void handleAddImages(files)}
              onRemove={(i) => void handleRemoveImage(i)}
              extra={
                isCreator && !textLocked ? (
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
          onSetEmoji={(emoji) => void handleSetEmoji(emoji)}
          onZoneNameSave={handleZoneNameSave}
          onOrderSave={handleOrderSave}
          onToggleHidden={handleToggleHidden}
          onSetSize={handleSetSize}
          onSetZone={handleSetZone}
          onSetSymbol={handleSetSymbol}
          onDeleteEdge={handleDeleteEdge}
          onSelectNode={onSelectNode}
          onEdit={onEdit}
          onStartPack={onStartPack}
          onStartChoose={onStartChoose}
          onExtractText={onExtractText}
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
  );
}
