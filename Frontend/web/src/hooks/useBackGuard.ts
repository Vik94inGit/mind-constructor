import { useEffect } from "react";

const GUARD = "mcBackGuard";

// Keeps a "back" gesture from leaving the page: the phone's back swipe or
// button, the iPhone's edge swipe, the browser's back button. One extra
// history entry for this same URL sits on top of the real one; going back
// lands on the real one, and the guard is put right back, so the page stays
// put. Leaving is left to the page's own way out (the map toolbar's ←, which
// replaces the guard instead of stacking on top of it).
//
// The guard carries the router's own history state along, so the router
// just sees the same location again when it's stepped off.
export function useBackGuard(active = true) {
  useEffect(() => {
    if (!active) return;
    const guarded = () => !!(window.history.state as Record<string, unknown> | null)?.[GUARD];
    const arm = () => {
      if (!guarded()) window.history.pushState({ ...(window.history.state ?? {}), [GUARD]: true }, "");
    };
    arm();
    // Back was pressed: we're on the real entry now — guard it again.
    const onPopState = () => arm();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [active]);
}
