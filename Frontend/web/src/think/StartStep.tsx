import { useI18n } from "../i18n/I18nContext";
import { NodeTypeIcon } from "../map/NodeTypeIcon";
import { MAP_KINDS } from "../types";
import type { ThoughtDraft } from "../utils/thoughtFlow";
import { btnPrimary, inputCls, KIND_ICON } from "./thinkStyles";
import { StepHeader, StepNav } from "./StepChrome";

export function StartStep({ draft, update, onNext }: { draft: ThoughtDraft; update: (p: Partial<ThoughtDraft>) => void; onNext: () => void }) {
  const { t } = useI18n();
  const tt = t.ui.think;
  const ready = draft.center.trim() !== "";
  return (
    <>
      <StepHeader title={tt.start.title} hint={tt.start.hint} />
      <fieldset className="m-0 mb-6 border-0 p-0">
        <legend className="mb-2 p-0 text-[0.8rem] font-semibold text-ink-soft">{tt.start.kindQuestion}</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MAP_KINDS.map((k) => {
            const selected = draft.kind === k;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  // Thoughts already written keep their kinds; only new ones
                  // follow the new set of questions.
                  update({ kind: k, promptIndex: 0 })
                }
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-left text-[0.9rem] font-semibold transition-[border-color,background-color] duration-[120ms] ${
                  selected ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface text-ink hover:border-accent"
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2">
                  <NodeTypeIcon type={KIND_ICON[k]} size={17} />
                </span>
                {tt.start.kinds[k].label}
              </button>
            );
          })}
        </div>
      </fieldset>
      <label htmlFor="think-center" className="mb-2 block text-[0.8rem] font-semibold text-ink-soft">
        {tt.start.centerLabel}
      </label>
      <textarea
        id="think-center"
        autoFocus
        rows={3}
        className={`${inputCls} resize-y text-[1.05rem]`}
        placeholder={tt.start.kinds[draft.kind].placeholder}
        value={draft.center}
        onChange={(e) => update({ center: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && ready) onNext();
        }}
      />
      <StepNav
        next={
          <button type="button" className={btnPrimary} disabled={!ready} onClick={onNext}>
            {tt.next} →
          </button>
        }
      />
    </>
  );
}
