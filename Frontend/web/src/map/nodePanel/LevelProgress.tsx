import { useI18n } from "../../i18n/I18nContext";
import type { TemplateProgress } from "../../utils/templateLevels";

// Where a leveled template grown from this node stands (utils/templateLevels.ts
// templateProgress): "Level 1 of 3 · 2 questions left", and a peek at what the
// next level will ask, without opening it.
export function LevelProgress({ progress }: { progress: TemplateProgress }) {
  const { t } = useI18n();
  const tt = t.ui.templates;
  return (
    <div data-testid="level-progress" className="mb-2 rounded-lg border border-line bg-surface-2 px-[0.7rem] py-[0.45rem] text-[0.8rem] text-ink-soft">
      <div className="font-semibold text-ink">
        {progress.done ? tt.progressDone(progress.levels) : tt.progress(progress.level, progress.levels, progress.left)}
      </div>
      {progress.next.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer select-none text-accent">{tt.peekNext(progress.level + 1)}</summary>
          <ul className="mt-1 list-disc pl-5">
            {progress.next.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
