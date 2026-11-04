// A tap on empty canvas opens the canvas menu (new node, templates, paste…)
// on touch, where there is no right-click. Only when the tap has nothing
// else to do: a tap that closes an open node, a group selection or a menu
// keeps doing just that, so the menu never pops up as a side effect of
// closing something. See docs/gestures/canvas-tap-menu.md.
export interface CanvasTapState {
  pointerType: string;
  somethingOpen: boolean;
  busyMode: boolean;
  entranceActive: boolean;
  canEdit: boolean;
}

export function canvasTapOpensMenu(s: CanvasTapState): boolean {
  return s.pointerType !== "mouse" && s.pointerType !== "" && !s.somethingOpen && !s.busyMode && !s.entranceActive && s.canEdit;
}
