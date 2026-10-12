import { useEffect, useState } from "react";

// "Computer mode": a wide screen driven by a mouse or trackpad. The map's
// toolbar then docks as a panel down the left edge, like a desktop's own
// taskbar / main menu, instead of floating over the canvas's top-left corner.
// Phones, tablets and narrow windows keep the compact floating cluster.
export const DESKTOP_QUERY = "(min-width: 1024px) and (pointer: fine)";

function matches(query: string): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.(query).matches;
}

function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => matches(query));
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const onChange = () => setMatch(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [query]);
  return match;
}

export function useDesktopLayout(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}
