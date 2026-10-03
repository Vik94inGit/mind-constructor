import { useI18n } from "../i18n/I18nContext";
import { btnPrimary, btnGhost, inputCls } from "./thinkStyles";
import { StepHeader, StepNav } from "./StepChrome";

export function BuildStep({
  count,
  name,
  setName,
  personal,
  setPersonal,
  building,
  error,
  onBack,
  onBuild,
}: {
  count: number;
  name: string;
  setName: (v: string) => void;
  personal: boolean;
  setPersonal: (v: boolean) => void;
  building: { done: number; total: number } | null;
  error: string | null;
  onBack: () => void;
  onBuild: () => void;
}) {
  const { t } = useI18n();
  const tt = t.ui.think;
  const modes = [
    { value: true, ...tt.build.personal },
    { value: false, ...tt.build.discussion },
  ];
  return (
    <>
      <StepHeader title={tt.build.title} hint={tt.build.hint} />
      {error && <div className="mb-4 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{error}</div>}

      <label htmlFor="think-name" className="mb-2 block text-[0.8rem] font-semibold text-ink-soft">
        {tt.build.name}
      </label>
      <input
        id="think-name"
        className={`${inputCls} mb-6`}
        value={name}
        maxLength={120}
        onChange={(e) => setName(e.target.value)}
        disabled={!!building}
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup">
        {modes.map((m) => {
          const on = personal === m.value;
          return (
            <button
              key={String(m.value)}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={!!building}
              onClick={() => setPersonal(m.value)}
              className={`cursor-pointer rounded-lg border px-4 py-3 text-left transition-[border-color,background-color] duration-[120ms] ${
                on ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-accent"
              }`}
            >
              <div className={`text-[0.92rem] font-semibold ${on ? "text-accent-ink" : "text-ink"}`}>{m.label}</div>
              <div className="mt-1 text-[0.8rem] text-ink-soft">{m.hint}</div>
            </button>
          );
        })}
      </div>

      <p className="mt-6 mb-0 text-[0.9rem] text-ink-soft">{tt.build.summary(count)}</p>

      {building && (
        <div className="mt-4" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${Math.round((building.done / Math.max(1, building.total)) * 100)}%` }}
            />
          </div>
          <p className="mt-2 mb-0 text-[0.8rem] text-ink-soft">{tt.build.building(building.done, building.total)}</p>
        </div>
      )}

      <StepNav
        back={
          <button type="button" className={btnGhost} onClick={onBack} disabled={!!building}>
            ← {tt.back}
          </button>
        }
        next={
          <button type="button" className={btnPrimary} onClick={onBuild} disabled={!!building || !name.trim()}>
            {tt.build.submit}
          </button>
        }
      />
    </>
  );
}
