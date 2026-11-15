// "More tools" (analysis/simplify-the-concept-2026-11-15.md): a newcomer sees
// only the basics of untangling a thought, and every other tool (discussion
// and its battle, pictures, looks, presentation, quiz, folders, power
// editing) waits behind one switch. Nothing is removed: the switch only
// hides. A new account starts with it off (the backend saves
// preferences.moreTools = false when it makes the account), an account made
// before the switch existed has nothing saved and keeps every tool, and a
// demo session (which saves nothing) starts with it off.

const KEY = "mc_more_tools";

/** Whether every tool shows: the saved choice, else this browser's, else on (off for a demo). */
export function moreToolsOn(saved: boolean | undefined, local: boolean | null, isDemo: boolean): boolean {
  if (saved !== undefined) return saved;
  if (local !== null) return local;
  return !isDemo;
}

// This browser's copy, shared by every component through a tiny store, so a
// switch flipped in the toolbar shows at once everywhere (a demo session has
// no server copy to carry it), and the next page load has the answer before
// the server's copy arrives.
const listeners = new Set<() => void>();

export function loadLocalMoreTools(): boolean | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

export function saveLocalMoreTools(on: boolean) {
  try {
    if (localStorage.getItem(KEY) === (on ? "1" : "0")) return;
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // Private mode: the switch still works for this page.
  }
  for (const l of listeners) l();
}

export function subscribeLocalMoreTools(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
