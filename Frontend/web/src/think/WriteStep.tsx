import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useI18n } from "../i18n/I18nContext";
import { NodeTypeIcon } from "../map/NodeTypeIcon";
import { FLOW_PROMPTS, ROOT_ID, newThoughtId, removeThought } from "../utils/thoughtFlow";
import type { Thought, ThoughtDraft } from "../utils/thoughtFlow";
import { btnPrimary, btnGhost, inputCls } from "./thinkStyles";
import { StepHeader, StepNav } from "./StepChrome";

export function WriteStep({
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
