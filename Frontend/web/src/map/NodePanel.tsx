import { useEffect, useRef, useState } from "react";
import * as nodesApi from "../api/nodes";
import * as edgesApi from "../api/edges";
import { ApiRequestError } from "../api/client";
import { idOf, nodeRefId, usernameOf, ZONE_COLORS } from "../utils/nodeType";
import { NodeTypeIcon } from "./NodeTypeIcon";
import { ringKindFor } from "./OutcomeBadge";
import { ATTACK_NODE_TYPES, MANUAL_ZONE_COLORS, PROTECT_NODE_TYPES, SIZE_TIERS, WEAPONS, WEAPON_INFO } from "../types";
import type { Attack, AttackNodeType, EdgeDoc, ManualZoneColor, NodeDoc, SizeTier, SymbolOverride, Weapon } from "../types";

// Same 100%/115%/130% scale NodeCard's own SIZE_MULTIPLIERS uses, just for
// the button labels here — kept as a separate literal rather than imported
// from NodeCard (a map component importing from another map component's
// internals isn't a pattern this codebase otherwise uses; this pairing is
// simple enough not to be worth a shared constants file).
const SIZE_TIER_LABEL: Record<SizeTier, string> = { 1: "100%", 2: "115%", 3: "130%" };

// Same 640px threshold MapPage's own isMobileViewport uses (not shared as
// an import — this file has no existing dependency on that one, and the
// two only need to ever agree on the cutoff, not on being the same
// function). Read live, not memoized, for the same reason: it only matters
// at the moment a key is actually pressed.
function isMobileViewport() {
  return typeof window !== "undefined" && window.innerWidth <= 640;
}

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
// sheet is opaque and always paints above the canvas. Two thirds on mobile
// instead (below Tailwind's `sm` = MapPage's own 640px isMobileViewport
// cutoff) — a phone's shorter screen needs more of it for a sheet worth
// reading, and centerOnNode still parks the chosen node in the third left
// above it. These 1/3 and 2/3 figures are shared with MapPage — see its
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
  "fixed inset-x-0 bottom-0 z-[46] max-h-[67dvh] sm:max-h-[34dvh] w-full overflow-y-auto rounded-t-2xl border-t border-line bg-surface p-5 shadow-[var(--shadow-card)]";

// Every section below used to render stacked, all at once — text, health,
// CRUD, links, the whole attack form, and history — which made this panel
// the tallest thing on the page for even the plainest node. Now the header
// only ever shows the type icon and a two-line clamp of the node's own
// text (see the header markup below); everything else lives behind one of
// these tabs, one screenful at a time. Which tabs actually show up (and
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
  onStartLink: () => void;
  onSelectNode: (nodeId: string) => void;
  /** Text/type editing now happens inline on the node's own icon on the canvas — this just asks the canvas to turn it on. No-ops there if editing isn't currently allowed. */
  onEdit: () => void;
  /** A new protection node landed, aimed at this node — MapPage upserts it same as any other node. healedNode: this node's own updated document, immediately healed once by the new shield. */
  onProtected: (protectionNode: NodeDoc, healedNode: NodeDoc) => void;
  /** Asks MapPage to open the pack picker for this node (owner-only — see the Info tab's Pack button). */
  onStartPack: () => void;
  /** One packed member got unpacked back to a normal, visible node. */
  onUnpacked: (node: NodeDoc) => void;
}

export function NodePanel({
  node,
  nodes,
  edges,
  currentUserId,
  onClose,
  onDeleted,
  onUpdated,
  onAttacked,
  onDeleteEdge,
  onStartLink,
  onSelectNode,
  onEdit,
  onProtected,
  onStartPack,
  onUnpacked,
}: Props) {
  const isCreator = idOf(node.userId) === currentUserId;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Attack[] | null>(null);
  // An attack now creates a real node — this is that node's content, filled
  // in before any of the weapon buttons below will actually fire.
  const [attackText, setAttackText] = useState("");
  const [attackType, setAttackType] = useState<AttackNodeType>("Problem");
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

  // Combat is fully open now (see attackAbl.ts's own comment) — no
  // own-node rule, no weapon-node exclusion, no already-defeated block.
  // Mirrors MapPage's canAttackNode exactly: any node is a valid target.
  function computeCanAttack() {
    return true;
  }
  const canAttack = computeCanAttack();
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
    ...(canAttack ? (["attack"] as const) : []),
    "protect",
    ...(packedMembers.length > 0 ? (["pack"] as const) : []),
    "history",
  ];
  const [tab, setTab] = useState<Tab>("info");

  useEffect(() => {
    setError(null);
    setAttackText("");
    setAttackType("Problem");
    setProtectText("");
    setProtectType("Solution");
    setTextDraft(node.text);
    setTab("info");
    nodesApi
      .getAttackHistory(node.nodeId)
      .then(setHistory)
      .catch(() => setHistory([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.nodeId]);

  // Owner-only (same as text/type edits) — a manual annotation over the
  // badge's symbol, not a rewrite of the node's own claim.
  async function handleSetSymbol(symbolOverride: SymbolOverride | null) {
    setBusy(true);
    setError(null);
    try {
      const updated = await nodesApi.updateNode(node.nodeId, { symbolOverride });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to update symbol");
    } finally {
      setBusy(false);
    }
  }

  // Enter (no Shift) in the textarea below — same updateNode call
  // handleSetSymbol already uses, just for `text` instead of
  // `symbolOverride`. A no-op (not an error) on empty/unchanged text, same
  // as the canvas's own inline editor's resolveInlineEdit does.
  async function handleTextSave() {
    const trimmed = textDraft.trim();
    if (!trimmed || trimmed === node.text) {
      setTextDraft(node.text);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await nodesApi.updateNode(node.nodeId, { text: trimmed });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to update text");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this node?")) return;
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
      setError(err instanceof ApiRequestError ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleAttack(weapon: Weapon) {
    if (!attackText.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await nodesApi.attackNode(node.nodeId, weapon, { type: attackType, text: attackText.trim() });
      onAttacked(res.node, res.weaponNode, weapon, res.healedParent, res.blocked, res.protector);
      // Landing an attack — blocked or not — creates a real node (the
      // weapon node carrying the attacker's own objection); closing here
      // matches every other node-creating action in this panel (Protect
      // below, Pack's own confirm in MapPage) instead of leaving the panel
      // sitting open on whatever was just acted on.
      onClose();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Attack failed");
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
      setError(err instanceof ApiRequestError ? err.message : "Protect failed");
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
      setError(err instanceof ApiRequestError ? err.message : "Unpack failed");
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
      setError(err instanceof ApiRequestError ? err.message : "Failed to update size");
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
      setError(err instanceof ApiRequestError ? err.message : "Failed to update zone");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteEdge(edgeId: string) {
    try {
      await edgesApi.deleteEdge(edgeId);
      onDeleteEdge(edgeId);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to remove link");
    }
  }

  const connectedEdges = edges.filter(
    (e) => nodeRefId(e.fromNodeId) === node.nodeId || nodeRefId(e.toNodeId) === node.nodeId,
  );

  const nodeById = (id: string) => nodes.find((n) => n.nodeId === id);

  const tabLabel: Record<Tab, string> = {
    info: "Info",
    links: "Links",
    attack: "Attack",
    protect: "Protect",
    pack: `Packed (${packedMembers.length})`,
    history: "History",
  };

  return (
    <div className={PANEL_CLASS}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-[0.5rem]">
          <div
            className="flex flex-shrink-0 items-center text-[0.68rem] font-bold tracking-[0.03em] text-ink-soft uppercase"
            title={node.type}
          >
            <NodeTypeIcon type={node.type} />
          </div>
          <div className="min-w-0">
            {/* Used to be a 2-line clamp with the rest only reachable via a
                hover `title` tooltip — useless on a touch screen, which has
                no hover state, so a long node's text was simply
                unreadable in the panel on a phone. This bottom sheet
                already scrolls its own content (see PANEL_CLASS's
                overflow-y-auto), so letting the text wrap to however many
                lines it needs costs nothing but a taller header. */}
            <p className="m-0 text-[0.88rem] leading-snug text-ink">{node.text}</p>
            <p className="m-0 text-[0.72rem] text-ink-soft">
              {node.isWeapon ? "🏹 " : ""}by {usernameOf(node.userId as any)}
              {node.isFirstNode ? " · root" : ""}
            </p>
          </div>
        </div>
        <button className={closeBtn} onClick={onClose}>
          ✕
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{error}</div>
      )}

      {tabs.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-[0.35rem] border-b border-line pb-[0.8rem]">
          {tabs.map((t) => (
            <button key={t} className={tabBtn(tab === t)} onClick={() => setTab(t)}>
              {tabLabel[t]}
            </button>
          ))}
        </div>
      )}

      {tab === "info" && (
        <div className="mt-4">
          {isCreator && (
            <div className="mb-3 flex flex-col gap-[0.35rem]">
              <label htmlFor="node-text" className="text-[0.8rem] font-semibold text-ink-soft">
                Text
              </label>
              <textarea
                id="node-text"
                rows={2}
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
                    handleTextSave();
                  }
                  // Shift+Enter (desktop), or plain Enter on mobile: no
                  // preventDefault — the textarea's own default behavior
                  // (insert a newline) is exactly what's wanted here.
                }}
                onBlur={handleTextSave}
                className="resize-none rounded-lg border border-line bg-surface px-[0.7rem] py-[0.55rem] text-[0.88rem] font-[inherit] text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent"
              />
            </div>
          )}
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
            {node.health}/100 health{node.defeated ? " · defeated" : ""}
          </p>

          {node.isWeapon && target && (
            <p style={{ fontSize: "0.8rem", marginTop: "0.4rem" }}>
              Points at{" "}
              <a role="button" style={{ cursor: "pointer" }} onClick={() => onSelectNode(target.nodeId)}>
                {target.text.slice(0, 40)}
              </a>
            </p>
          )}

          {node.isProtection && protectedTarget && (
            <p style={{ fontSize: "0.8rem", marginTop: "0.4rem" }}>
              🛡️ Protects{" "}
              <a role="button" style={{ cursor: "pointer" }} onClick={() => onSelectNode(protectedTarget.nodeId)}>
                {protectedTarget.text.slice(0, 40)}
              </a>
            </p>
          )}

          {node.isProtection && !!node.blockedDamage && (
            <p style={{ fontSize: "0.78rem", marginTop: "0.3rem", color: "var(--ink-soft)" }}>
              Blocked {node.blockedDamage} damage so far — deleting this shield returns all of it to{" "}
              {protectedTarget ? protectedTarget.text.slice(0, 30) : "the node it defends"} at once.
            </p>
          )}

          {protectors.length > 0 && (
            <p style={{ fontSize: "0.8rem", marginTop: "0.4rem" }}>
              🛡️ Protected by{" "}
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

          {isCreator && (
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <button
                className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onEdit}
              >
                Edit
              </button>
              <button
                className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onStartPack}
                title="Fold other linked/branched nodes into this one"
              >
                Pack…
              </button>
              <button
                className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-danger-bg bg-danger-bg px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-danger transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleDelete}
                disabled={busy}
              >
                Delete
              </button>
            </div>
          )}

          {isCreator && (
            <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>Size:</span>
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
              <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>Zone:</span>
              {MANUAL_ZONE_COLORS.map((z) => (
                <button
                  key={z}
                  className="inline-flex cursor-pointer items-center justify-center rounded-lg border px-[0.55rem] py-[0.3rem] text-[0.8rem] font-semibold capitalize transition-[background-color,border-color,opacity] duration-[120ms] disabled:cursor-not-allowed disabled:opacity-50"
                  style={
                    node.manualZone === z
                      ? { borderColor: ZONE_COLORS[z], background: `${ZONE_COLORS[z]}26`, color: ZONE_COLORS[z] }
                      : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }
                  }
                  onClick={() => handleSetZone(z)}
                  disabled={busy}
                  title={`Draw a ${z} zone ring around just this node`}
                >
                  {z}
                </button>
              ))}
              {node.manualZone && (
                <button
                  className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-transparent bg-transparent px-[0.55rem] py-[0.3rem] text-[0.78rem] font-semibold text-ink-soft transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => handleSetZone(null)}
                  disabled={busy}
                  title="Remove this manual zone ring"
                >
                  Reset
                </button>
              )}
            </div>
          )}

          {isCreator && isOutcome && (
            <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>Symbol:</span>
              <button
                className={`inline-flex cursor-pointer items-center justify-center rounded-lg border px-[0.55rem] py-[0.3rem] text-[0.85rem] font-semibold transition-[background-color,border-color,opacity] duration-[120ms] disabled:cursor-not-allowed disabled:opacity-50 ${
                  node.symbolOverride === "check"
                    ? "border-accent bg-accent-soft text-accent-ink"
                    : "border-line bg-surface text-ink enabled:hover:bg-surface-2"
                }`}
                onClick={() => handleSetSymbol("check")}
                disabled={busy}
                title="Force a check mark, regardless of type"
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
                title="Force a cross, regardless of type"
              >
                ✗
              </button>
              {node.symbolOverride && (
                <button
                  className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-transparent bg-transparent px-[0.55rem] py-[0.3rem] text-[0.78rem] font-semibold text-ink-soft transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => handleSetSymbol(null)}
                  disabled={busy}
                  title="Use this type's own default symbol"
                >
                  Reset
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "links" && (
        <div className="mt-4">
          {isCreator ? (
            <button
              className="inline-flex w-full cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onStartLink}
            >
              Link from this node
            </button>
          ) : (
            <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
              Only {usernameOf(node.userId as any)} can link from this node.
            </p>
          )}
          {connectedEdges.length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)", marginTop: "0.5rem" }}>No links yet.</p>
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
                        {e.sentiment}
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
        </div>
      )}

      {tab === "attack" && canAttack && (
        <div className="mt-4">
          <p style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
            Landing an attack creates a real node with your objection, linked to this one by a
            weapon arrow.
            {node.isWeapon && " Landing this heals its own target's parent."}
            {protectors.length > 0 && " This node is currently shielded — attacks will be blocked."}
          </p>
          <div className="mb-4 flex flex-col gap-[0.35rem]">
            <label htmlFor="attack-text" className="text-[0.8rem] font-semibold text-ink-soft">
              Your objection
            </label>
            <textarea
              id="attack-text"
              rows={2}
              value={attackText}
              onChange={(e) => setAttackText(e.target.value)}
              placeholder="Why does this fail?"
              className="rounded-lg border border-line bg-surface px-[0.7rem] py-[0.55rem] text-[0.92rem] font-[inherit] text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent"
            />
          </div>
          <div className="mb-4 flex flex-col gap-[0.35rem]">
            <label htmlFor="attack-type" className="text-[0.8rem] font-semibold text-ink-soft">
              As a
            </label>
            <select
              id="attack-type"
              value={attackType}
              onChange={(e) => setAttackType(e.target.value as AttackNodeType)}
              className="rounded-lg border border-line bg-surface px-[0.7rem] py-[0.55rem] text-[0.92rem] font-[inherit] text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent"
            >
              {ATTACK_NODE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          {!attackText.trim() && (
            <p style={{ fontSize: "0.78rem", color: "var(--accent)", fontWeight: 600 }}>
              Write your objection above to pick a weapon.
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
                  title={needsText ? "Write your objection first" : undefined}
                  onClick={() => handleAttack(w)}
                >
                  <span>
                    {info.label} (-{info.damage})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab === "protect" && (
        <div className="mt-4">
          {isCreator ? (
            <>
              <p style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
                A protection node fully blocks every future attack on this node while it stays
                undefeated — no limit, no cooldown.
              </p>
              <div className="mb-4 flex flex-col gap-[0.35rem]">
                <label htmlFor="protect-text" className="text-[0.8rem] font-semibold text-ink-soft">
                  Why it's defended
                </label>
                <textarea
                  id="protect-text"
                  rows={2}
                  value={protectText}
                  onChange={(e) => setProtectText(e.target.value)}
                  placeholder="Why does this hold up?"
                  className="rounded-lg border border-line bg-surface px-[0.7rem] py-[0.55rem] text-[0.92rem] font-[inherit] text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent"
                />
              </div>
              <div className="mb-4 flex flex-col gap-[0.35rem]">
                <label htmlFor="protect-type" className="text-[0.8rem] font-semibold text-ink-soft">
                  As a
                </label>
                <select
                  id="protect-type"
                  value={protectType}
                  onChange={(e) => setProtectType(e.target.value as AttackNodeType)}
                  className="rounded-lg border border-line bg-surface px-[0.7rem] py-[0.55rem] text-[0.92rem] font-[inherit] text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent"
                >
                  {PROTECT_NODE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="inline-flex w-full cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-accent bg-accent px-[0.65rem] py-[0.55rem] text-[0.88rem] font-semibold text-white transition-opacity duration-[120ms] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={busy || !protectText.trim()}
                title={!protectText.trim() ? "Write why it's defended first" : undefined}
                onClick={handleProtect}
              >
                🛡️ Add protection
              </button>
            </>
          ) : (
            <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
              Only {usernameOf(node.userId as any)} can add a protection node to this one.
            </p>
          )}
        </div>
      )}

      {tab === "pack" && (
        <div className="mt-4">
          {packedMembers.length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>Nothing packed in here.</p>
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
                    Unpack
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
            <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>Loading…</p>
          ) : history.length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>No attacks yet.</p>
          ) : (
            history.map((a, i) => (
              <div className="flex justify-between border-b border-line py-[0.4rem] text-[0.8rem] last:border-b-0" key={i}>
                <span>
                  {usernameOf(a.attackerId as any)} · {a.weapon}
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
