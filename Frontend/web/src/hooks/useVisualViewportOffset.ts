import { useEffect, useState } from "react";
import { isEditableTarget } from "../utils/editable";

export interface ViewportOffset {
  top: number;
  left: number;
}

// How far the part of the page actually on screen has slid from the page's
// top-left. On a tablet the keyboard slides over the page
// (interactive-widget=resizes-visual in index.html), and the browser slides
// the visible part, or scrolls the whole page, to show the field being typed
// into. That carried the map's floating toolbar off the top of the screen.
// The toolbar moves by this much to stay in sight.
//
// The map page never scrolls as a whole, only its canvas does, so once
// nothing is being typed in, a page left scrolled is put back at the top.
// iPad browsers (Safari's engine, Chrome included) leave it scrolled after
// the keyboard goes, for example when the node panel is closed mid-edit.
export function useVisualViewportOffset(): ViewportOffset {
  const [offset, setOffset] = useState<ViewportOffset>({ top: 0, left: 0 });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    const update = () => {
      // pageTop: the keyboard's slide plus any scroll of the page itself.
      const top = Math.max(0, Math.round(vv ? (vv.pageTop ?? vv.offsetTop + window.scrollY) : window.scrollY));
      const left = Math.max(0, Math.round(vv ? (vv.pageLeft ?? vv.offsetLeft + window.scrollX) : window.scrollX));
      setOffset((cur) => (cur.top === top && cur.left === left ? cur : { top, left }));
    };
    const resetIfIdle = () => {
      if (isEditableTarget(document.activeElement)) return;
      if (vv && vv.scale > 1.01) return; // the user zoomed the page on purpose
      if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
      update();
    };
    const onChange = () => {
      update();
      resetIfIdle();
    };
    // After a field loses focus the keyboard takes a moment to slide away,
    // and the browser may scroll once more as it goes.
    const timers: ReturnType<typeof setTimeout>[] = [];
    const onFocusOut = () => {
      timers.push(setTimeout(resetIfIdle, 100), setTimeout(resetIfIdle, 500));
    };
    onChange();
    vv?.addEventListener("resize", onChange);
    vv?.addEventListener("scroll", onChange);
    window.addEventListener("scroll", onChange);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      vv?.removeEventListener("resize", onChange);
      vv?.removeEventListener("scroll", onChange);
      window.removeEventListener("scroll", onChange);
      document.removeEventListener("focusout", onFocusOut);
      timers.forEach(clearTimeout);
    };
  }, []);
  return offset;
}
