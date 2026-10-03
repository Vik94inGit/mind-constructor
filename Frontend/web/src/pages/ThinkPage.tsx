import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { ApiRequestError } from "../api/client";
import { ThoughtPreview } from "../components/ThoughtPreview";
import { FLOW_ROOT_TYPE, buildMapFromDraft, clearDraft, emptyDraft, loadDraft, saveDraft, suggestMapName } from "../utils/thoughtFlow";
import type { Thought, ThoughtDraft } from "../utils/thoughtFlow";
import { StartStep } from "../think/StartStep";
import { WriteStep } from "../think/WriteStep";
import { ShapeStep } from "../think/ShapeStep";
import { BuildStep } from "../think/BuildStep";

// "Think it through": a guided path from a thought in someone's head to a map
// on the canvas, built to get people writing rather than configuring.
//   1. Start — pick what kind of thinking this is, write the central thought.
//   2. Write — one guiding question at a time; Enter adds a thought, Enter on
//      an empty line moves on. A live preview grows with every thought.
//   3. Shape — check each thought's kind and what it hangs from.
//   4. Map it — name it, choose who it's for, and build the real map.
// Everything is kept as a draft in this browser until the map is built.

const STEP_COUNT = 4;

export function ThinkPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const tt = t.ui.think;
  const navigate = useNavigate();
  const location = useLocation();
  const userId = user?._id ?? "anon";

  // A fresh start from the dashboard's "What's on your mind?" box carries its
  // text in; otherwise pick up whatever draft was left here last time.
  const [draft, setDraft] = useState<ThoughtDraft>(() => {
    const seed = (location.state as { seed?: string } | null)?.seed?.trim();
    const saved = loadDraft(userId);
    if (seed) return { ...(saved && !saved.center.trim() ? saved : emptyDraft(saved?.kind)), center: seed, step: 0 };
    return saved ?? emptyDraft();
  });
  const [name, setName] = useState("");
  const [personal, setPersonal] = useState(true);
  const [building, setBuilding] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!building) saveDraft(userId, draft);
  }, [draft, userId, building]);

  const update = (patch: Partial<ThoughtDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const setThoughts = (fn: (ts: Thought[]) => Thought[]) => setDraft((d) => ({ ...d, thoughts: fn(d.thoughts) }));
  const goTo = (step: number) => {
    if (step === 3 && !name.trim()) setName(suggestMapName(draft.center));
    update({ step });
    window.scrollTo({ top: 0 });
  };

  const filled = draft.thoughts.filter((x) => x.text.trim());
  const canReach = (step: number) => step === 0 || (draft.center.trim() !== "" && (step <= 2 || filled.length > 0));

  function startOver() {
    if (!confirm(tt.startOverConfirm)) return;
    clearDraft(userId);
    setDraft(emptyDraft(draft.kind));
    setName("");
  }

  async function build() {
    setError(null);
    setBuilding({ done: 0, total: filled.length + 1 });
    try {
      const map = await buildMapFromDraft(
        draft,
        { name, personal, ownerColor: "#22c55e", color: "#e08a3e" },
        (done, total) => setBuilding({ done, total }),
      );
      clearDraft(userId);
      navigate(`/maps/${map.mapId}`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? `${tt.build.error} (${err.message})` : tt.build.error);
      setBuilding(null);
    }
  }

  const stepLabels = [tt.steps.start, tt.steps.write, tt.steps.shape, tt.steps.build];

  return (
    <div className="mx-auto w-full max-w-[1080px] px-4 pt-6 pb-16 sm:px-6 sm:pt-8">
      {/* Progress: every step reachable once its prerequisites are met, so the
          user can jump back to add a thought without losing anything. */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <ol className="m-0 flex list-none items-center gap-1 p-0 sm:gap-2" aria-label={tt.stepOf(draft.step + 1, STEP_COUNT)}>
          {stepLabels.map((label, i) => {
            const active = i === draft.step;
            const done = i < draft.step;
            return (
              <li key={label} className="flex items-center gap-1 sm:gap-2">
                {i > 0 && <span className={`h-px w-3 sm:w-6 ${done || active ? "bg-accent" : "bg-line"}`} aria-hidden />}
                <button
                  type="button"
                  disabled={!canReach(i) || !!building}
                  onClick={() => goTo(i)}
                  aria-current={active ? "step" : undefined}
                  className={`flex cursor-pointer items-center gap-[0.4rem] rounded-[20px] border px-[0.6rem] py-[0.3rem] text-[0.78rem] font-semibold transition-colors duration-[120ms] disabled:cursor-not-allowed disabled:opacity-50 ${
                    active
                      ? "border-accent bg-accent text-white"
                      : done
                        ? "border-accent bg-accent-soft text-accent-ink"
                        : "border-line bg-surface text-ink-soft"
                  }`}
                >
                  <span className="tabular-nums">{done ? "✓" : i + 1}</span>
                  <span className={active ? "" : "hidden sm:inline"}>{label}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="flex items-center gap-3 text-[0.75rem] text-ink-soft">
          {(draft.center.trim() || draft.thoughts.length > 0) && !building && (
            <>
              <span>{tt.saved}</span>
              <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-[0.75rem] font-semibold text-ink-soft underline hover:text-ink" onClick={startOver}>
                {tt.startOver}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section key={draft.step} className="animate-thought-in min-w-0">
          {draft.step === 0 && <StartStep draft={draft} update={update} onNext={() => goTo(1)} />}
          {draft.step === 1 && (
            <WriteStep draft={draft} update={update} setThoughts={setThoughts} onBack={() => goTo(0)} onNext={() => goTo(2)} />
          )}
          {draft.step === 2 && <ShapeStep draft={draft} setThoughts={setThoughts} onBack={() => goTo(1)} onNext={() => goTo(3)} />}
          {draft.step === 3 && (
            <BuildStep
              count={filled.length}
              name={name}
              setName={setName}
              personal={personal}
              setPersonal={setPersonal}
              building={building}
              error={error}
              onBack={() => goTo(2)}
              onBuild={build}
            />
          )}
        </section>
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <ThoughtPreview center={draft.center} rootType={FLOW_ROOT_TYPE[draft.kind]} thoughts={draft.thoughts} title={tt.preview} />
          {draft.center.trim() && (
            <p className="mt-3 mb-0 line-clamp-3 px-1 text-[0.82rem] text-ink-soft italic">“{draft.center.trim()}”</p>
          )}
        </aside>
      </div>
    </div>
  );
}
