import type { KeyboardEvent } from "react";

// Roving focus for a row of choices that is one Tab stop (the node panel's
// tabs, the type picker): the arrow keys walk the row, wrapping round, and
// Home/End jump to its ends. The row's current choice is the only item with
// tabIndex 0, so Tab goes in on it and straight out past the rest.

/** Where focus goes next for `key` from `index` in a row of `count`, or null when the key doesn't move it. */
export function nextRovingIndex(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (index + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/**
 * The row's onKeyDown: moves focus among the enabled items matching
 * `selector` inside it and returns the index (among those items) it moved
 * to, or null when the key wasn't one of the row's.
 */
export function moveRovingFocus(e: KeyboardEvent<HTMLElement>, selector: string): number | null {
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !(el as HTMLButtonElement).disabled,
  );
  const from = items.indexOf(document.activeElement as HTMLElement);
  if (from < 0) return null;
  const to = nextRovingIndex(e.key, from, items.length);
  if (to === null) return null;
  e.preventDefault();
  items[to].focus();
  return to;
}
