import { useEffect, useState } from "react";

// "Computer mode": a wide screen driven by a mouse or trackpad. The map's
// toolbar then docks as a panel down the left edge, like a desktop's own
// taskbar / main menu, instead of floating over the canvas's top-left corner.
// Phones, tablets and narrow windows keep the compact floating cluster.
export const DESKTOP_QUERY = "(min-width: 1024px) and (pointer: fine)";

function matches(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.(DESKTOP_QUERY).matches;
}

export function useDesktopLayout(): boolean {
  const [desktop, setDesktop] = useState(matches);
  useEffect(() => {
    const mq = window.matchMedia?.(DESKTOP_QUERY);
    if (!mq) return;
    const onChange = () => setDesktop(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return desktop;
}
