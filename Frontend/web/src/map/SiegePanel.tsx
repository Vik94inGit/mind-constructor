import { useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import * as nodesApi from "../api/nodes";
import { ApiRequestError } from "../api/client";
import { NEEDS_OWN_CASTLE, STRATEGIES, planMove } from "../utils/siege";
import type { Hold, Strategy } from "../utils/siege";
import type { NodeDoc } from "../types";

interface Props {
  holds: (Hold & { name: string })[];
  nodes: NodeDoc[];
  onAttacked: (res: Awaited<ReturnType<typeof nodesApi.attackNode>>) => void;
  onProtected: (res: Awaited<ReturnType<typeof nodesApi.protectNode>>) => void;
  /** The node the move landed on — MapPage centers the view on it. */
  onFocus: (nodeId: string) => void;
  onExit: () => void;
}

const btn =
  "inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold transition-[background-color,border-color,opacity] duration-[120ms] disabled:cursor-not-allowed disabled:opacity-50";
const idle = "border-line bg-surface text-ink enabled:hover:bg-surface-2";
const picked = "border-accent bg-accent-soft text-accent-ink";
const select = "w-full min-w-0 rounded-lg border border-line bg-surface px-2 py-[0.3rem] text-[0.8rem] text-ink";

const LABEL_MAX = 60;

// The opponent's turn in discussion mode (see utils/siege.ts): pick who
// attacks (an invader, or one of your own castles in a civil war), which
// castle, and a strategy; one press places one move on the map and hands the
// turn back. Takes over the bottom-sheet slot like DrawLineBar.
export function SiegePanel({ holds, nodes, onAttacked, onProtected, onFocus, onExit }: Props) {
  const { t } = useI18n();
  const s = t.ui.siege;
  const [attacker, setAttacker] = useState<string>("");
  const [target, setTarget] = useState<string>(holds[0]?.rootId ?? "");
  const [strategy, setStrategy] = useState<Strategy>("siege");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  // Sally and fortify need an attacking castle; with an invader picked they
  // fall back to a siege rather than leaving nothing chosen.
  const active: Strategy = NEEDS_OWN_CASTLE.includes(strategy) && !attacker ? "siege" : strategy;
  const targets = holds.filter((h) => h.rootId !== attacker);
  const targetId = targets.some((h) => h.rootId === target) ? target : (targets[0]?.rootId ?? "");
  const holdLabel = (h: Hold & { name: string }) => `${h.kind === "kingdom" ? "👑" : "🏰"} ${h.name}`;

  function labelOf(nodeId: string) {
    const n = nodes.find((x) => x.nodeId === nodeId);
    const name = n?.title || n?.text || n?.zoneName || (n ? t.ui.types[n.type] : "");
    return name.length > LABEL_MAX ? `${name.slice(0, LABEL_MAX)}…` : name;
  }

  async function makeMove() {
    const move = planMove(active, targetId, attacker || null, nodes);
    if (!move) {
      setMessage({ tone: "error", text: s.nothing });
      return;
    }
    const text = s.moves[active](labelOf(move.targetId));
    setBusy(true);
    setMessage(null);
    try {
      // byOpponent: the move is the opponent's, not yours — it shows with the
      // opponent's flag, and counts as their word when you want to finish.
      if (move.action === "attack")
        onAttacked(await nodesApi.attackNode(move.targetId, move.weapon, { type: move.type, text, byOpponent: true }));
      else onProtected(await nodesApi.protectNode(move.targetId, { type: move.type, text, byOpponent: true }));
      onFocus(move.targetId);
      setMessage({ tone: "ok", text: s.done(s.strategies[active].name, labelOf(move.targetId)) });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof ApiRequestError ? err.message : s.failed });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[46] flex max-h-[50vh] flex-col gap-2 overflow-y-auto border-t border-line bg-surface px-5 py-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-3">
        <strong className="text-[0.9rem] text-ink" title={s.intro}>
          ♜ {s.title}
        </strong>
        <button className={`${btn} ${idle}`} onClick={onExit} aria-label={t.ui.common.close}>
          ✕
        </button>
      </div>
      {holds.length === 0 ? (
        <p className="text-[0.82rem] text-ink-soft">{s.noHolds}</p>
      ) : (
        <>
                    <div className="flex flex-wrap gap-2">
            <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-[0.75rem] text-ink-soft">
              {s.attacker}
              <select className={select} value={attacker} onChange={(e) => setAttacker(e.target.value)}>
                <option value="">⚑ {s.invader}</option>
                {holds.map((h) => (
                  <option key={h.rootId} value={h.rootId}>
                    {holdLabel(h)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-[0.75rem] text-ink-soft">
              {s.target}
              <select className={select} value={targetId} onChange={(e) => setTarget(e.target.value)}>
                {targets.map((h) => (
                  <option key={h.rootId} value={h.rootId}>
                    {holdLabel(h)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-[0.35rem]" role="radiogroup" aria-label={s.title}>
            {STRATEGIES.map((key) => {
              const blocked = NEEDS_OWN_CASTLE.includes(key) && !attacker;
              const on = active === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={blocked}
                  title={blocked ? s.needsCastle : s.strategies[key].hint}
                  className={`${btn} ${on ? picked : idle}`}
                  onClick={() => {
                    setStrategy(key);
                    setMessage(null);
                  }}
                >
                  {s.strategies[key].name}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-3">
            {/* The chosen strategy's hint, until a move replaces it with what happened. */}
            <span
              className={`text-[0.8rem] ${message?.tone === "error" ? "font-semibold text-danger" : message ? "text-ink" : "text-ink-soft"}`}
            >
              {message?.text ?? s.strategies[active].hint}
            </span>
            <button
              className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg border border-accent bg-accent px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-white transition-opacity duration-[120ms] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={busy || !targetId}
              onClick={() => void makeMove()}
            >
              {s.go}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
