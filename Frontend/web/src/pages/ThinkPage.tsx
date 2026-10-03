import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { ApiRequestError } from "../api/client";
import { NodeTypeIcon } from "../map/NodeTypeIcon";
import { ThoughtPreview } from "../components/ThoughtPreview";
import { MAP_KINDS, NODE_TYPES } from "../types";
import type { MapKind, NodeType } from "../types";
import {
  FLOW_PROMPTS,
  FLOW_ROOT_TYPE,
  ROOT_ID,
  buildMapFromDraft,
  clearDraft,
  emptyDraft,
  isWithin,
  loadDraft,
  newThoughtId,
  orderParentsFirst,
  removeThought,
  saveDraft,
  suggestMapName,
} from "../utils/thoughtFlow";
import type { Thought, ThoughtDraft } from "../utils/thoughtFlow";

// "Think it through": a guided path from a thought in someone's head to a map
// on the canvas, built to get people writing rather than configuring.
//   1. Start — pick what kind of thinking this is, write the central thought.
//   2. Write — one guiding question at a time; Enter adds a thought, Enter on
//      an empty line moves on. A live preview grows with every thought.
//   3. Shape — check each thought's kind and what it hangs from.
//   4. Map it — name it, choose who it's for, and build the real map.
// Everything is kept as a draft in this browser until the map is built.

const STEP_COUNT = 4;

const btnPrimary =
  "inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-accent bg-accent px-4 py-[0.55rem] text-[0.88rem] font-semibold text-white transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
const btnGhost =
  "inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-4 py-[0.55rem] text-[0.88rem] font-semibold text-ink transition-[background-color,border-color] duration-[120ms] enabled:hover:border-accent disabled:cursor-not-allowed disabled:opacity-50";
const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-[0.6rem] text-[0.95rem] text-ink outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]";

const KIND_ICON: Record<MapKind, NodeType> = { problem: "Problem", decision: "Option", goal: "Success", retro: "unknown" };

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

function StepHeader({ title, hint }: { title: string; hint: string }) {
  return (
    <header className="mb-5">
      <h1 className="m-0 text-[1.6rem] leading-tight font-bold">{title}</h1>
      <p className="mt-2 mb-0 max-w-[60ch] text-[0.95rem] text-ink-soft">{hint}</p>
    </header>
  );
}

function StepNav({ back, next }: { back?: ReactNode; next: ReactNode }) {
  return (
    <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
      <div>{back}</div>
      <div>{next}</div>
    </div>
  );
}

function StartStep({ draft, update, onNext }: { draft: ThoughtDraft; update: (p: Partial<ThoughtDraft>) => void; onNext: () => void }) {
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

function WriteStep({
  draft,
  update,
  setThoughts,
  onBack,
  onNext,
}: {
  draft: ThoughtDraft;
  update: (p: Partial<ThoughtDraft>) => void;
  setThoughts: (fn: (ts: Thought[]) => Thought[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { t } = useI18n();
  const tt = t.ui.think;
  const prompts = FLOW_PROMPTS[draft.kind];
  const index = Math.min(draft.promptIndex, prompts.length - 1);
  const prompt = prompts[index];
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const count = draft.thoughts.filter((x) => x.text.trim()).length;
  const here = draft.thoughts.filter((x) => x.prompt === prompt.key);
  const answered = useMemo(() => new Set(draft.thoughts.map((x) => x.prompt)), [draft.thoughts]);
  const isLast = index === prompts.length - 1;

  const goPrompt = (i: number) => {
    update({ promptIndex: Math.max(0, Math.min(prompts.length - 1, i)) });
    setText("");
    inputRef.current?.focus();
  };

  function add() {
    const value = text.trim();
    if (!value) return;
    setThoughts((ts) => [...ts, { id: newThoughtId(), text: value, type: prompt.type, parentId: ROOT_ID, prompt: prompt.key }]);
    setText("");
    inputRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    // Enter on an empty line is "I'm done with this one" — keeps the hands on
    // the keyboard the whole way through.
    if (text.trim()) add();
    else if (!isLast) goPrompt(index + 1);
  }

  return (
    <>
      <StepHeader title={tt.write.title} hint={tt.write.hint} />

      <div className="rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-[0.75rem] font-semibold tracking-[0.04em] text-ink-soft uppercase">
            {tt.write.questionOf(index + 1, prompts.length)}
          </span>
          {/* One dot per question: filled once it has an answer. */}
          <div className="flex gap-[0.35rem]">
            {prompts.map((p, i) => (
              <button
                key={p.key}
                type="button"
                title={tt.prompts[p.key]}
                aria-label={tt.prompts[p.key]}
                onClick={() => goPrompt(i)}
                className={`h-[10px] w-[10px] cursor-pointer rounded-full border p-0 transition-colors ${
                  i === index ? "border-accent bg-accent" : answered.has(p.key) ? "border-accent bg-accent-soft" : "border-line bg-surface-2"
                }`}
              />
            ))}
          </div>
        </div>

        <h2 key={prompt.key} className="animate-thought-in m-0 mb-4 flex items-start gap-2 text-[1.3rem] leading-snug font-bold">
          <span className="mt-[0.3rem]">
            <NodeTypeIcon type={prompt.type} size={18} />
          </span>
          {tt.prompts[prompt.key]}
        </h2>

        <div className="flex gap-2">
          <input
            ref={inputRef}
            autoFocus
            className={inputCls}
            placeholder={tt.write.placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label={tt.prompts[prompt.key]}
          />
          <button type="button" className={btnPrimary} disabled={!text.trim()} onClick={add}>
            {tt.write.add}
          </button>
        </div>

        {here.length > 0 && (
          <ul className="m-0 mt-4 flex list-none flex-wrap gap-2 p-0">
            {here.map((x) => (
              <li
                key={x.id}
                className="animate-thought-in flex max-w-full items-center gap-2 rounded-[20px] border border-line bg-surface-2 py-[0.3rem] pr-[0.35rem] pl-3 text-[0.88rem]"
              >
                <NodeTypeIcon type={x.type} size={13} />
                <span className="min-w-0 break-words">{x.text}</span>
                <button
                  type="button"
                  aria-label={`${tt.write.remove}: ${x.text}`}
                  title={tt.write.remove}
                  onClick={() => setThoughts((ts) => removeThought(ts, x.id))}
                  className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-ink-soft hover:bg-line hover:text-ink"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent p-0 text-[0.82rem] font-semibold text-ink-soft hover:text-ink disabled:invisible"
            disabled={index === 0}
            onClick={() => goPrompt(index - 1)}
          >
            ← {tt.write.prevQuestion}
          </button>
          {!isLast && (
            <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-[0.82rem] font-semibold text-accent-ink hover:underline" onClick={() => goPrompt(index + 1)}>
              {tt.write.nextQuestion} →
            </button>
          )}
        </div>
        {isLast && <p className="mt-3 mb-0 text-[0.82rem] text-ink-soft">{tt.write.allAnswered}</p>}
      </div>

      <p className="mt-4 mb-0 flex items-center gap-2 text-[0.88rem]" aria-live="polite">
        <span className="rounded-[20px] bg-accent-soft px-[0.6rem] py-[0.15rem] text-[0.78rem] font-semibold text-accent-ink tabular-nums">
          {tt.write.count(count)}
        </span>
        <span className="text-ink-soft">{tt.write.encourage(count)}</span>
      </p>

      <StepNav
        back={
          <button type="button" className={btnGhost} onClick={onBack}>
            ← {tt.back}
          </button>
        }
        next={
          <button type="button" className={btnPrimary} disabled={count === 0} onClick={onNext}>
            {tt.next} →
          </button>
        }
      />
    </>
  );
}

function ShapeStep({
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

function BuildStep({
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
