import { useState } from "react";
import { quizCards } from "../utils/quiz";
import type { QuizCard } from "../utils/quiz";
import type { NodeDoc } from "../types";
import { feature } from "../utils/usage";

interface Params {
  visibleNodes: NodeDoc[];
  hiddenBranchIds: Set<string>;
  /** Node text arrives lazily (MapPage's ensureNodeText); the quiz waits for it. */
  ensureNodeText: (ids: string[]) => Promise<Record<string, string>>;
  setActionError: (message: string | null) => void;
  emptyMessage: string;
}

// Quiz me (docs/gestures/quiz-me.md, map/QuizOverlay.tsx): which cards the
// map makes, worked out once when it starts. The same nodes presentation
// mode shows: no attack or shield nodes, nothing hidden from members.
export function useQuiz({ visibleNodes, hiddenBranchIds, ensureNodeText, setActionError, emptyMessage }: Params) {
  const [quizCardsState, setQuizCards] = useState<QuizCard[] | null>(null);

  function startQuiz() {
    feature("quiz");
    const eligible = visibleNodes.filter((n) => !n.isWeapon && !n.isProtection && !hiddenBranchIds.has(n.nodeId));
    void ensureNodeText(eligible.map((n) => n.nodeId)).then((texts) => {
      const withText = eligible.map((n) => (texts[n.nodeId] !== undefined && !n.text ? { ...n, text: texts[n.nodeId] } : n));
      const cards = quizCards(withText);
      if (cards.length === 0) {
        setActionError(emptyMessage);
        return;
      }
      setQuizCards(cards);
    });
  }

  return { quizCards: quizCardsState, startQuiz, exitQuiz: () => setQuizCards(null) };
}
