import { useI18n } from "../i18n/I18nContext";
import { NODE_TYPE_COLORS } from "../utils/nodeType";
import { NodeTypeSymbol } from "./NodeTypeSymbol";
import { MathText } from "./MathText";
import { countByType, filterByTypes, groupByType, isAnswered, isTemplateMap, templateAnswerGroups } from "../utils/mapSummary";
import type { AnswerGroup } from "../utils/mapSummary";
import { NODE_TYPES } from "../types";
import type { NodeDoc, NodeType } from "../types";

const chipCls =
  "inline-flex cursor-pointer items-center gap-[0.35rem] rounded-full border px-[0.65rem] py-[0.3rem] text-[0.8rem] font-semibold transition-colors duration-[120ms]";

// The row of type chips under the presentation's header: one per type the
// map has, with how many nodes of it, plus "All". Picking types narrows the
// slides and the summary to those types; picking none shows every type.
export function TypeFilterChips({
  nodes,
  value,
  onChange,
}: {
  nodes: NodeDoc[];
  value: NodeType[];
  onChange: (types: NodeType[]) => void;
}) {
  const { t } = useI18n();
  const counts = countByType(nodes);
  const present = NODE_TYPES.filter((type) => counts[type] > 0);
  if (present.length < 2) return null;
  const toggle = (type: NodeType) =>
    onChange(value.includes(type) ? value.filter((v) => v !== type) : [...value, type]);
  return (
    <div
      className="flex flex-wrap items-center gap-2 px-5 pb-3"
      role="group"
      aria-label={t.ui.presentation.filterTypes}
      data-type-filter
    >
      <button
        type="button"
        aria-pressed={value.length === 0}
        className={`${chipCls} ${value.length === 0 ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface text-ink-soft hover:bg-surface-2"}`}
        onClick={() => onChange([])}
      >
        {t.ui.presentation.allTypes}
      </button>
      {present.map((type) => {
        const on = value.includes(type);
        return (
          <button
            key={type}
            type="button"
            aria-pressed={on}
            className={`${chipCls} ${on ? "bg-surface-2 text-ink" : "border-line bg-surface text-ink-soft hover:bg-surface-2"}`}
            style={on ? { borderColor: NODE_TYPE_COLORS[type] } : undefined}
            onClick={() => toggle(type)}
          >
            <NodeTypeSymbol type={type} size={14} />
            {t.ui.types[type]}
            <span className="tabular-nums opacity-70">{counts[type]}</span>
          </button>
        );
      })}
    </div>
  );
}

interface Props {
  nodes: NodeDoc[];
  typeFilter: NodeType[];
  /** Opens this node's slide when it has one; otherwise shows it on the map. */
  onPick: (nodeId: string) => void;
}

// The presentation's Summary tab. A template map (it still carries a ghost's
// question) reads as its questions and answers, level by level, each level
// with how far it's filled in; any other map reads as its nodes grouped by
// type. Both follow the type chips. Logic in utils/mapSummary.ts.
export function PresentationSummary({ nodes, typeFilter, onPick }: Props) {
  const { t } = useI18n();
  const shown = filterByTypes(nodes, typeFilter);
  if (shown.length === 0) {
    return <p className="m-0 py-12 text-center text-ink-soft">{t.ui.presentation.noMatch}</p>;
  }
  if (isTemplateMap(nodes)) {
    const { groups, other } = templateAnswerGroups(shown);
    return (
      <div className="flex w-full max-w-[900px] flex-col gap-6 text-left" data-summary="template">
        <h2 className="m-0 text-[1.3rem] font-bold text-ink">{t.ui.presentation.answersTitle}</h2>
        {groups.map((g) => (
          <LevelSection key={g.level ?? "none"} group={g} onPick={onPick} />
        ))}
        {other.length > 0 && (
          <section className="flex flex-col gap-3">
            <h3 className="m-0 text-[1.05rem] font-bold text-ink">{t.ui.presentation.otherNotes}</h3>
            <NodeList nodes={other} onPick={onPick} />
          </section>
        )}
      </div>
    );
  }
  return (
    <div className="flex w-full max-w-[900px] flex-col gap-6 text-left" data-summary="types">
      <h2 className="m-0 text-[1.3rem] font-bold text-ink">{t.ui.presentation.byTypeTitle}</h2>
      {groupByType(shown).map((g) => (
        <section key={g.type} className="flex flex-col gap-3" data-type-group={g.type}>
          <h3 className="m-0 flex items-center gap-2 text-[1.05rem] font-bold" style={{ color: NODE_TYPE_COLORS[g.type] }}>
            <NodeTypeSymbol type={g.type} size={20} />
            {t.ui.types[g.type]}
            <span className="text-[0.85rem] font-semibold text-ink-soft tabular-nums">{g.nodes.length}</span>
          </h3>
          <NodeList nodes={g.nodes} onPick={onPick} hideType />
        </section>
      ))}
    </div>
  );
}

function LevelSection({ group, onPick }: { group: AnswerGroup; onPick: (id: string) => void }) {
  const { t } = useI18n();
  const pct = group.total > 0 ? (group.answered / group.total) * 100 : 0;
  return (
    <section className={`flex flex-col gap-3 ${group.locked ? "opacity-60" : ""}`} data-level={group.level ?? ""}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="m-0 text-[1.05rem] font-bold text-ink">
          {group.level !== null ? t.ui.presentation.level(group.level) : t.ui.presentation.questions}
        </h3>
        <span className="text-[0.85rem] text-ink-soft tabular-nums">
          {t.ui.presentation.answeredOf(group.answered, group.total)}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={group.total}
        aria-valuenow={group.answered}
        aria-label={t.ui.presentation.answeredOf(group.answered, group.total)}
      >
        <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
      {group.locked && group.level !== null && (
        <p className="m-0 text-[0.85rem] text-ink-soft">🔒 {t.ui.presentation.locked(group.level - 1)}</p>
      )}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {group.items.map((q) => {
          const answered = isAnswered(q);
          return (
            <li key={q.nodeId}>
              <button
                type="button"
                data-question
                className="flex w-full min-w-0 cursor-pointer flex-col gap-1 rounded-card border-l-4 border-y-0 border-r-0 bg-surface-2/50 px-3 py-2 text-left transition-colors duration-[120ms] hover:bg-surface-2"
                style={{ borderLeftColor: NODE_TYPE_COLORS[q.type] }}
                onClick={() => onPick(q.nodeId)}
              >
                <span className="text-[0.85rem] text-ink-soft break-words">{q.prompt}</span>
                {answered ? (
                  <span className="text-[1rem] font-semibold break-words whitespace-pre-line text-ink">
                    <MathText text={q.title || q.text} />
                  </span>
                ) : (
                  <span className="text-[0.95rem] text-ink-soft italic">{t.ui.presentation.notAnswered}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function NodeList({ nodes, onPick, hideType }: { nodes: NodeDoc[]; onPick: (id: string) => void; hideType?: boolean }) {
  const { t } = useI18n();
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
      {nodes.map((n) => (
        <li key={n.nodeId}>
          <button
            type="button"
            data-summary-node
            className="flex h-full w-full min-w-0 cursor-pointer flex-col gap-1 rounded-card border-2 bg-surface px-3 py-2 text-left transition-colors duration-[120ms] hover:bg-surface-2"
            style={{ borderColor: NODE_TYPE_COLORS[n.type] }}
            onClick={() => onPick(n.nodeId)}
          >
            {!hideType && (
              <span className="flex items-center gap-1 text-[0.7rem] font-bold tracking-[0.05em] uppercase" style={{ color: NODE_TYPE_COLORS[n.type] }}>
                <NodeTypeSymbol type={n.type} size={14} />
                {t.ui.types[n.type]}
              </span>
            )}
            <span className="text-[0.95rem] font-semibold break-words text-ink">
              <MathText text={n.title || n.text || n.prompt || ""} />
            </span>
            {n.title && n.text && <span className="line-clamp-3 text-[0.85rem] break-words text-ink-soft">{n.text}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
