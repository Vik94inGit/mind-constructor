import { useRef, useState } from "react";

// A short, auto-dismissed confirmation banner ("Copied 3 nodes…") — the
// success-flavored counterpart to the error banner MapPage shows separately,
// which stays until the user dismisses it or the next action replaces it.
export function useNotice() {
  const [notice, setNotice] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showNotice(message: string) {
    setNotice(message);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setNotice(null), 5000);
  }

  function dismissNotice() {
    setNotice(null);
  }

  return { notice, showNotice, dismissNotice };
}
