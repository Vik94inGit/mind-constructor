import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import { MathText } from "./MathText";
import { roundOrder, roundTally } from "../utils/quiz";
import type { QuizCard, QuizMark, QuizMarks } from "../utils/quiz";

interface Props {
  /** Every card the map makes, in map order (utils/quiz.ts quizCards). */
  cards: QuizCard[];
  /** The viewer's marks so far — a round starts with what isn't known yet. */
  marks: QuizMarks;
  onMark: (nodeId: string, mark: QuizMark) => void;
  onExit: () => void;
}

const MARK_STYLE: Record<QuizMark, string> = {
  notYet: "border-danger text-danger hover:bg-danger hover:text-white",
  shaky: "border-[#d97706] text-[#b45309] hover:bg-[#d97706] hover:text-white",
  know: "border-success text-success hover:bg-success hover:text-white",
};

const btn =
  "cursor-pointer rounded-lg border px-[0.9rem] py-[0.55rem] text-[0.9rem] font-semibold transition-colors duration-[120ms]";

// Quiz me (docs/gestures/quiz-me.md): a full-screen card over the map, the
// same takeover presentation mode uses. The question shows; a tap (or Space)
// turns the card; the reader marks it not yet / shaky / know it (or 1 2 3),
// and the next card comes. The end of a round counts the marks and offers to
// go over the shaky ones. Esc or Exit leaves; marks given are kept.
export function QuizOverlay({ cards, marks, onMark, onExit }: Props) {
  const { t } = useI18n();
  const q = t.ui.quiz;
  // The round's cards, fixed when it starts so a mark doesn't reshuffle it.
  const [round, setRound] = useState<QuizCard[]>(() => roundOrder(cards, marks));
  const [index, setIndex] = useState(0);
  const [turned, setTurned] = useState(false);
  // What was given this round, for the tally at its end.
  const [given, setGiven] = useState<QuizMarks>({});
  // What the reader wrote down before turning each card, by node, kept for
  // the round so ← back still shows it beside the answer. Never saved.
  const [guesses, setGuesses] = useState<Record<string, string>>({});
  const card = round[index];
  const guess = card ? (guesses[card.nodeId] ?? "") : "";
  const finished = index >= round.length;
  const tally = useMemo(() => roundTally(given), [given]);
  const weakLeft = tally.notYet + tally.shaky;

  function mark(m: QuizMark) {
    if (!card || !turned) return;
    onMark(card.nodeId, m);
    setGiven((g) => ({ ...g, [card.nodeId]: m }));
    setTurned(false);
    setIndex((i) => i + 1);
  }
  function back() {
    if (index === 0) return;
    setIndex((i) => i - 1);
    setTurned(true);
  }
  function startRound(weakOnly: boolean) {
    setRound(roundOrder(cards, { ...marks, ...given }, weakOnly));
    setGiven({});
    setGuesses({});
    setIndex(0);
    setTurned(false);
  }

  useEffect(() => {
    // Capture phase on window, ahead of the map's own shortcuts
    // (hooks/useMapKeyboard.ts), and stopped there: nothing typed while the
    // quiz is open reaches the map hidden under it (copy, paste, delete).
    function onKey(e: KeyboardEvent) {
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        onExit();
        return;
      }
      if (finished) return;
      // Writing a guess: keys are letters, not shortcuts. Ctrl/Cmd+Enter turns.
      if (e.target instanceof HTMLTextAreaElement) {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          setTurned(true);
        }
        return;
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setTurned(true);
      } else if (e.key === "1") mark("notYet");
      else if (e.key === "2") mark("shaky");
      else if (e.key === "3") mark("know");
      else if (e.key === "ArrowLeft") back();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface" role="dialog" aria-label={q.entry}>
      <div className="flex items-center justify-between gap-3 px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <span className="text-[0.85rem] font-semibold text-ink">? {q.entry}</span>
        <span className="text-[0.85rem] text-ink-soft" data-quiz-count>
          {q.count(Math.min(index + 1, round.length), round.length)}
        </span>
        <button
          type="button"
          onClick={onExit}
          className="cursor-pointer rounded-lg border border-line bg-surface px-[0.7rem] py-[0.4rem] text-[0.8rem] font-semibold text-ink transition-colors duration-[120ms] hover:bg-surface-2"
        >
          {q.exit}
        </button>
      </div>
      <div className="mx-5 h-[4px] overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${(Math.min(index, round.length) / Math.max(1, round.length)) * 100}%` }} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4 sm:px-8">
        {finished ? (
          <div className="my-auto flex flex-col items-center gap-4 text-center" data-quiz-end>
            <h2 className="m-0 text-[1.4rem] font-bold text-ink">{q.roundDone}</h2>
            <p className="m-0 text-[1rem] text-ink-soft">{q.tally(tally.know, tally.shaky, tally.notYet)}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {weakLeft > 0 ? (
                <button type="button" className={`${btn} border-accent bg-accent text-white`} onClick={() => startRound(true)}>
                  {q.again}
                </button>
              ) : (
                <button type="button" className={`${btn} border-line text-ink hover:bg-surface-2`} onClick={() => startRound(false)}>
                  {q.restart}
                </button>
              )}
              <button type="button" className={`${btn} border-line text-ink hover:bg-surface-2`} onClick={onExit}>
                {q.done}
              </button>
            </div>
          </div>
        ) : (
          card && (
            <div className="my-auto flex w-full flex-col items-center gap-4">
              <button
                type="button"
                data-quiz-card
                aria-expanded={turned}
                onClick={() => setTurned(true)}
                className={`w-full max-w-[720px] rounded-2xl border-2 bg-surface px-5 py-6 text-center shadow-card ${turned ? "cursor-default border-line" : "cursor-pointer border-accent"}`}
              >
                <div className="text-[clamp(1.25rem,4vw,2rem)] leading-tight font-bold break-words whitespace-pre-line text-ink">
                  <MathText text={card.question} />
                </div>
                {turned ? (
                  <div
                    className={`mt-4 grid gap-4 border-t border-line pt-4 text-left text-[1.05rem] leading-relaxed text-ink ${guess.trim() ? "sm:grid-cols-2" : ""}`}
                  >
                    {guess.trim() && (
                      <div className="rounded-xl bg-surface-2 px-4 py-3" data-quiz-guess>
                        <div className="mb-1 text-[0.75rem] font-semibold tracking-wide text-ink-soft uppercase">{q.yourGuess}</div>
                        <p className="m-0 break-words whitespace-pre-line">
                          <MathText text={guess.trim()} />
                        </p>
                      </div>
                    )}
                    <div className={guess.trim() ? "rounded-xl border border-success px-4 py-3" : ""} data-quiz-answer>
                    {guess.trim() && (
                      <div className="mb-1 text-[0.75rem] font-semibold tracking-wide text-success uppercase">{q.trueAnswer}</div>
                    )}
                    {card.answer && (
                      <p className="m-0 break-words whitespace-pre-line">
                        <MathText text={card.answer} />
                      </p>
                    )}
                    {card.answerList && (
                      <ul className={`m-0 list-disc pl-6 ${card.answer ? "mt-3" : ""}`}>
                        {card.answerList.map((a, i) => (
                          <li key={i} className="break-words whitespace-pre-line">
                            <MathText text={a} />
                          </li>
                        ))}
                      </ul>
                    )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-[0.85rem] text-ink-soft">{q.hint}</div>
                )}
              </button>

              {!turned && (
                <textarea
                  key={card.nodeId}
                  data-quiz-guess-input
                  value={guess}
                  onChange={(e) => setGuesses((g) => ({ ...g, [card.nodeId]: e.target.value }))}
                  placeholder={q.guessPlaceholder}
                  aria-label={q.yourGuess}
                  rows={3}
                  className="w-full max-w-[720px] resize-y rounded-xl border border-line bg-surface px-4 py-3 text-[1rem] text-ink outline-none placeholder:text-ink-soft focus:border-accent"
                />
              )}

              {turned ? (
                <div className="flex flex-wrap justify-center gap-2" role="group">
                  {(["notYet", "shaky", "know"] as const).map((m, i) => (
                    <button key={m} type="button" className={`${btn} bg-surface ${MARK_STYLE[m]}`} onClick={() => mark(m)} title={`${i + 1}`}>
                      {q[m]}
                    </button>
                  ))}
                </div>
              ) : (
                <button type="button" className={`${btn} border-accent bg-accent text-white`} onClick={() => setTurned(true)}>
                  {q.showAnswer}
                </button>
              )}
              {index > 0 && (
                <button type="button" className="cursor-pointer text-[0.8rem] text-ink-soft underline" onClick={back}>
                  ← {q.back}
                </button>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
