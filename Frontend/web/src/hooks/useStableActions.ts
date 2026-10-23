import { useLayoutEffect, useRef, useState } from "react";

type Actions = Record<string, (...args: any[]) => any>;

// An object of callbacks that stays the same object for the component's whole
// life, while each call still runs the newest version passed in. Handing it to
// a memoized child (MapPage's CanvasNodeCard) lets the child skip re-rendering
// when only the parent re-rendered, which a fresh inline arrow per render
// would defeat. The callbacks are meant for events, not for rendering: they
// read the latest version only once the render has committed.
export function useStableActions<T extends Actions>(actions: T): T {
  const latest = useRef(actions);
  useLayoutEffect(() => {
    latest.current = actions;
  });
  const [stable] = useState(() => {
    const out = {} as Actions;
    for (const key of Object.keys(actions)) out[key] = (...args) => latest.current[key](...args);
    return out as T;
  });
  return stable;
}
