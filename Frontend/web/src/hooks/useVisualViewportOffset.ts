import { useEffect, useState } from "react";

export interface ViewportOffset {
  top: number;
  left: number;
}

// How far the part of the page actually on screen has slid from the page's
// top-left. On a tablet the keyboard slides over the page
// (interactive-widget=resizes-visual in index.html), and Chrome slides the
// visible part down to show the field being typed into, which carried the
// map's floating toolbar off the top of the screen. The toolbar moves by this
// much to stay in sight. Once the keyboard is gone and the visible part is
// the whole page again, a page left scrolled is put back at the top: the map
// page never scrolls as a whole, only its canvas does.
export function useVisualViewportOffset(): ViewportOffset {
  const [offset, setOffset] = useState<ViewportOffset>({ top: 0, left: 0 });
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const update = () => {
      const fullHeight = vv.height >= window.innerHeight - 1 && vv.scale <= 1.01;
      if (fullHeight && (window.scrollY !== 0 || window.scrollX !== 0)) window.scrollTo(0, 0);
      // pageTop: the keyboard's slide plus any scroll of the page itself.
      const top = Math.max(0, Math.round(vv.pageTop ?? vv.offsetTop));
      const left = Math.max(0, Math.round(vv.pageLeft ?? vv.offsetLeft));
      setOffset((cur) => (cur.top === top && cur.left === left ? cur : { top, left }));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return offset;
}
