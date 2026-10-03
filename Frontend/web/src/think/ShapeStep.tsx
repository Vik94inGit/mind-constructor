import { useI18n } from "../i18n/I18nContext";
import { NodeTypeIcon } from "../map/NodeTypeIcon";
import { NODE_TYPES } from "../types";
import { ROOT_ID, isWithin, newThoughtId, orderParentsFirst, removeThought } from "../utils/thoughtFlow";
import type { Thought, ThoughtDraft } from "../utils/thoughtFlow";
import { btnPrimary, btnGhost, inputCls } from "./thinkStyles";
import { StepHeader, StepNav } from "./StepChrome";

export function ShapeStep({
  draft,
  setThoughts,
  onBack,
  onNext,
}: {
  draft: ThoughtDraft;
  setThoughts: (fn: (ts: Thought[]) => Thought[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { t } = useI18n();
  const tt = t.ui.think;
  const ordered = orderParentsFirst(draft.thoughts);
  const depth = new Map<string, number>([[ROOT_ID, 0]]);
  for (const x of ordered) depth.set(x.id, (depth.get(x.parentId) ?? 0) + 1);
  const label = (x: Thought) => (x.text.trim().length > 48 ? `${x.text.trim().slice(0, 47)}…` : x.text.trim() || tt.shape.newThought);
  const patch = (id: string, p: Partial<Thought>) => setThoughts((ts) => ts.map((x) => (x.id === id ? { ...x, ...p } : x)));

  return (
    <>
      <StepHeader title={tt.shape.title} hint={tt.shape.hint} />

      {ordered.length === 0 && (
        <p className="rounded-card border border-dashed border-line px-5 py-8 text-center text-ink-soft">{tt.shape.empty}</p>
      )}

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {ordered.map((x) => (
          <li
            key={x.id}
            className="rounded-card border border-line bg-surface p-4 shadow-card"
            // Indent by depth (capped) so the list already reads as a tree.
            style={{ marginLeft: `${Math.min(3, (depth.get(x.id) ?? 1) - 1) * 1.25}rem` }}
          >
            <div className="flex items-start gap-2">
              <textarea
                rows={1}
                className={`${inputCls} min-h-[2.6rem] resize-y`}
                value={x.text}
                placeholder={tt.shape.newThought}
                autoFocus={!x.text}
                onChange={(e) => patch(x.id, { text: e.target.value })}
                aria-label={tt.shape.newThought}
              />
              <button
                type="button"
                title={tt.shape.remove}
                aria-label={`${tt.shape.remove}: ${x.text}`}
                className="mt-[0.35rem] flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent bg-transparent text-ink-soft hover:border-line hover:text-danger"
                onClick={() => setThoughts((ts) => removeThought(ts, x.id))}
              >
                ×
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={t.ui.types[x.type]}>
                {NODE_TYPES.map((type) => {
                  const on = x.type === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      title={t.ui.types[type]}
                      onClick={() => patch(x.id, { type })}
                      className={`flex cursor-pointer items-center gap-1 rounded-[20px] border px-2 py-[0.25rem] text-[0.75rem] font-semibold transition-colors ${
                        on ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface text-ink-soft hover:border-accent"
                      }`}
                    >
                      <NodeTypeIcon type={type} size={13} />
                      {on && <span>{t.ui.types[type]}</span>}
                    </button>
                  );
                })}
              </div>
              <label className="flex min-w-0 items-center gap-2 text-[0.78rem] text-ink-soft">
                <span className="shrink-0 font-semibold">{tt.shape.hangsFrom}</span>
                <select
                  className="max-w-[16rem] min-w-0 rounded-lg border border-line bg-surface px-2 py-[0.3rem] text-[0.8rem] text-ink"
                  value={draft.thoughts.some((o) => o.id === x.parentId) ? x.parentId : ROOT_ID}
                  onChange={(e) => patch(x.id, { parentId: e.target.value })}
                >
                  <option value={ROOT_ID}>{tt.shape.center}</option>
                  {ordered
                    // Never offer itself or anything hanging from it — that would make a loop.
                    .filter((o) => !isWithin(o.id, x.id, draft.thoughts))
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {label(o)}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="mt-3 w-full cursor-pointer rounded-card border border-dashed border-line bg-transparent px-4 py-3 text-[0.88rem] font-semibold text-ink-soft hover:border-accent hover:text-ink"
        onClick={() =>
          setThoughts((ts) => [...ts, { id: newThoughtId(), text: "", type: "unknown", parentId: ROOT_ID, prompt: "anythingElse" }])
        }
      >
        {tt.shape.add}
      </button>

      <StepNav
        back={
          <button type="button" className={btnGhost} onClick={onBack}>
            ← {tt.back}
          </button>
        }
        next={
          <button type="button" className={btnPrimary} disabled={!draft.thoughts.some((x) => x.text.trim())} onClick={onNext}>
            {tt.next} →
          </button>
        }
      />
    </>
  );
}
