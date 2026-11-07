import { useRef, useState } from "react";

/** A button on the notice, such as Undo right after a template grew. */
export interface NoticeAction {
  label: string;
  run: () => void;
}

// A short, auto-dismissed confirmation banner ("Copied 3 nodes…") — the
// success-flavored counterpart to the error banner MapPage shows separately,
// which stays until the user dismisses it or the next action replaces it.
// A notice with a button stays a little longer, to give time to reach it.
export function useNotice() {
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeAction, setNoticeAction] = useState<NoticeAction | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showNotice(message: string, action?: NoticeAction) {
    setNotice(message);
    setNoticeAction(action ?? null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setNotice(null);
      setNoticeAction(null);
    }, action ? 10000 : 5000);
  }

  function dismissNotice() {
    setNotice(null);
    setNoticeAction(null);
  }

  return { notice, noticeAction, showNotice, dismissNotice };
}
