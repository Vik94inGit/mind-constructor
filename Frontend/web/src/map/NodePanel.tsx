import { useEffect, useState } from "react";
import * as nodesApi from "../api/nodes";
import * as edgesApi from "../api/edges";
import { ApiRequestError } from "../api/client";
import { idOf, nodeRefId, usernameOf } from "../utils/nodeType";
import { NodeTypeIcon } from "./NodeTypeIcon";
import { ringKindFor } from "./OutcomeBadge";
import { ATTACK_NODE_TYPES, WEAPONS, WEAPON_INFO } from "../types";
import type { Attack, AttackNodeType, EdgeDoc, NodeDoc, SymbolOverride, Weapon } from "../types";

// A bottom sheet overlaying the canvas, at every screen size — not just
// this panel's own ✕, MapPage's dimming backdrop (see the JSX that renders
// this) closes it too, same as a native sheet dismisses on a tap outside it.
// Used to switch to an inline right-hand sidebar at `sm` and up; moved off
// that in favor of always keeping the canvas full-width and the node's text
// anchored to the bottom of the view, on any device.
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
const PANEL_CLASS =
  "fixed inset-x-0 bottom-0 z-40 max-h-[75dvh] w-full overflow-y-auto rounded-t-2xl border-t border-line bg-surface p-5 shadow-[var(--shadow-card)]";

// Every section below used to render stacked, all at once — text, health,
// CRUD, links, the whole attack form, and history — which made this panel
// the tallest thing on the page for even the plainest node. Now the header
// only ever shows the type icon and a two-line clamp of the node's own
// text (see the header markup below); everything else lives behind one of
// these tabs, one screenful at a time. Which tabs actually show up (and
// which one opens by default) still depends on the node — see tabsFor below.
type Tab = "info" | "links" | "attack" | "history";

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
  /** Map.discussionMode — flips whose nodes the Attack section shows on (see attackNodeAbl.ts server-side); everything else here is unaffected. */
  discussionMode: boolean;
  cooldowns: Partial<Record<Weapon, number>>;
  onClose: () => void;
  onDeleted: (nodeId: string) => void;
  /** Fired after a direct panel-side PATCH (currently just the symbol-override toggle below) with the server's response, so the canvas/other panels stay in sync — same upsert-by-id MapPage already does for every other node update. */
  onUpdated: (node: NodeDoc) => void;
  onAttacked: (node: NodeDoc, weaponNode: NodeDoc, weapon: Weapon) => void;
  onCooldown: (weapon: Weapon, readyAt: number) => void;
  onDeleteEdge: (edgeId: string) => void;
  onStartLink: () => void;
  onSelectNode: (nodeId: string) => void;
  /** Text/type editing now happens inline on the node's own icon on the canvas — this just asks the canvas to turn it on. No-ops there if editing isn't currently allowed. */
  onEdit: () => void;
}

export function NodePanel({
  node,
  nodes,
  edges,
  currentUserId,
  discussionMode,
  cooldowns,
  onClose,
  onDeleted,
  onUpdated,
  onAttacked,
  onCooldown,
  onDeleteEdge,
  onStartLink,
  onSelectNode,
  onEdit,
}: Props) {
  const isCreator = idOf(node.userId) === currentUserId;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Attack[] | null>(null);
  const [now, setNow] = useState(Date.now());
  // An attack now creates a real node — this is that node's content, filled
  // in before any of the weapon buttons below will actually fire.
  const [attackText, setAttackText] = useState("");
  const [attackType, setAttackType] = useState<AttackNodeType>("Problem");

  // Mirrors attackNodeAbl.ts's own-node rule exactly: normal mode only
  // lands on someone else's node, discussion mode only on your own.
  const canAttack = !node.defeated && (discussionMode ? isCreator : !isCreator);
  // Only an outcome type (see OutcomeBadge.tsx) actually draws an inner
  // symbol at all — "unknown" nodes render the plain NodeTypeIcon glyph
  // instead, nothing here to override.
  const isOutcome = !!ringKindFor(node.type);
  // A weapon node's own attacker can edit its objection text/type (see
  // MapPage's canEditNode) and delete it, same CRUD every other node's
  // creator gets — but it never gets Links/Attack/History tabs of its own,
  // so this is the one place that check needs to reach beyond isCreator.
  const canEditWeapon = node.isWeapon && isCreator;

  // Which tabs this node actually has anything behind, and which one opens
  // by default — a weapon node only ever gets "info" (its own CRUD lives
  // there too, see canEditWeapon above); a regular node gets Links and
  // History always, Attack only when canAttack agrees.
  const tabs: Tab[] = node.isWeapon ? ["info"] : ["info", "links", ...(canAttack ? (["attack"] as const) : []), "history"];
  const [tab, setTab] = useState<Tab>("info");

  useEffect(() => {
    setError(null);
    setAttackText("");
    setAttackType("Problem");
    setTab("info");
    if (!node.isWeapon) {
      nodesApi
        .getAttackHistory(node.nodeId)
        .then(setHistory)
        .catch(() => setHistory([]));
    } else {
      setHistory(null);
    }
  }, [node.nodeId]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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

  async function handleDelete() {
    if (!confirm("Delete this node?")) return;
    setBusy(true);
    try {
      await nodesApi.deleteNode(node.nodeId);
      onDeleted(node.nodeId);
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
      onAttacked(res.node, res.weaponNode, weapon);
      const info = WEAPON_INFO[weapon];
      if (info.cooldownMs > 0) onCooldown(weapon, Date.now() + info.cooldownMs);
      setAttackText("");
      nodesApi.getAttackHistory(node.nodeId).then(setHistory).catch(() => {});
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 429 && err.readyAt) {
        onCooldown(weapon, new Date(err.readyAt).getTime());
        setError("That weapon is still on cooldown.");
      } else {
        setError(err instanceof ApiRequestError ? err.message : "Attack failed");
      }
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

  const tabLabel: Record<Tab, string> = { info: "Info", links: "Links", attack: "Attack", history: "History" };

  if (node.isWeapon) {
    const targetId = nodeRefId(node.targetNodeId);
    const target = targetId ? nodes.find((n) => n.nodeId === targetId) : undefined;
    return (
      <div className={PANEL_CLASS}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="m-0 mb-[0.15rem] text-[0.78rem] font-bold tracking-[0.03em] text-ink-soft uppercase">
              {/* One consistent bow icon regardless of which weapon landed —
                  see WEAPON_ARROW_COUNT's own doc comment. */}
              🏹 Attack · {node.type}
            </h3>
            <p className="m-0 line-clamp-2 text-[0.88rem] leading-snug text-ink" title={node.text}>
              {node.text}
            </p>
          </div>
          <button className={closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{error}</div>
        )}

        <div className="mt-4 border-t border-line pt-[1rem]">
          {target && (
            <p style={{ fontSize: "0.8rem" }}>
              Points at{" "}
              <a role="button" style={{ cursor: "pointer" }} onClick={() => onSelectNode(target.nodeId)}>
                {target.text.slice(0, 40)}
              </a>
            </p>
          )}
          <p style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
            Launched by {usernameOf(node.userId as any)}
          </p>
          {canEditWeapon && (
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem", alignItems: "center" }}>
              <button
                className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onEdit}
              >
                Edit
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
        </div>
      </div>
    );
  }

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
            <p className="m-0 line-clamp-2 text-[0.88rem] leading-snug text-ink" title={node.text}>
              {node.text}
            </p>
            <p className="m-0 text-[0.72rem] text-ink-soft">
              by {usernameOf(node.userId as any)}
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

          {isCreator && (
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", alignItems: "center" }}>
              <button
                className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onEdit}
              >
                Edit
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
            {discussionMode && " Discussion mode: you can only challenge your own nodes."}
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
              const readyAt = cooldowns[w] ?? 0;
              const isOnCooldown = readyAt > now;
              const needsText = !attackText.trim();
              return (
                <button
                  key={w}
                  className="inline-flex w-full cursor-pointer items-center justify-between gap-[0.4rem] rounded-lg border border-line bg-surface px-4 py-[0.55rem] text-[0.88rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={busy || isOnCooldown || needsText}
                  title={needsText ? "Write your objection first" : undefined}
                  onClick={() => handleAttack(w)}
                >
                  <span>
                    {info.label} (-{info.damage})
                  </span>
                  <span>{isOnCooldown ? `${Math.ceil((readyAt - now) / 1000)}s` : ""}</span>
                </button>
              );
            })}
          </div>
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
