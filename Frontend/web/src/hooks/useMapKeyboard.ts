import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import { imageFilesFrom } from "../utils/images";

interface Params {
  presenting: boolean;
  exitPresentation: () => void;
  setSlideIndex: Dispatch<SetStateAction<number>>;
  slideCount: number;
  drawMode: boolean;
  drawPointCount: number;
  undoDrawPoint: () => void;
  finishLine: () => Promise<void> | void;
  clearDrawPoints: () => void;
  exitDrawMode: () => void;
  chooseMode: boolean;
  hasGroupSelection: boolean;
  exitChooseMode: () => void;
  copySelection: () => void;
  pasteClipboard: () => void;
  /** A picture was pasted with no node of your own open to take it (an open node's panel takes it itself — see NodePanel). */
  onImagePasteWithoutNode?: () => void;
}

export function useMapKeyboard({
  presenting,
  exitPresentation,
  setSlideIndex,
  slideCount,
  drawMode,
  drawPointCount,
  undoDrawPoint,
  finishLine,
  clearDrawPoints,
  exitDrawMode,
  chooseMode,
  hasGroupSelection,
  exitChooseMode,
  copySelection,
  pasteClipboard,
  onImagePasteWithoutNode,
}: Params) {
  // Global Ctrl/Cmd+C / Ctrl/Cmd+V for the current node selection — ignored
  // whenever focus is inside a real text field (NodePanel's textarea, the
  // inline node-caption editor, PendingNodeCard's input, an attack
  // objection box, …), so normal copy/paste of *text* inside those keeps
  // working exactly as the browser already handles it; this only ever
  // fires for the "nothing text-editable is focused" case, i.e. the
  // canvas/selection itself has the user's attention.
  useEffect(() => {
    function isEditableTarget(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;
      // Presentation mode takes the keyboard over outright while active —
      // checked first, ahead of every other mode branch below, with a bare
      // `return` at the end so a presentation-mode keypress can never fall
      // through into copy/paste or any other mode's own shortcuts further
      // down (those read the selection/clipboard state that shouldn't be
      // reachable while presenting).
      if (presenting) {
        if (e.key === "Escape") {
          e.preventDefault();
          exitPresentation();
          return;
        }
        if (e.key === "ArrowRight" || e.key === " ") {
          e.preventDefault();
          setSlideIndex((i) => Math.min(i + 1, slideCount - 1));
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setSlideIndex((i) => Math.max(i - 1, 0));
          return;
        }
        return;
      }
      // Drawing a line: Enter finishes it, Backspace / Ctrl+Z takes back the
      // last point, Escape clears the line (or leaves drawing when nothing is
      // placed). A focused button keeps its own Enter.
      if (drawMode) {
        const onControl = e.target instanceof HTMLElement && !!e.target.closest("button, a, select, [role=menu]");
        if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
          e.preventDefault();
          undoDrawPoint();
          return;
        }
        if (!e.ctrlKey && !e.metaKey && !onControl) {
          if (e.key === "Enter") {
            e.preventDefault();
            void finishLine();
            return;
          }
          if (e.key === "Backspace") {
            e.preventDefault();
            undoDrawPoint();
            return;
          }
        }
        if (!e.ctrlKey && !e.metaKey && e.key === "Escape") {
          e.preventDefault();
          if (drawPointCount > 0) clearDrawPoints();
          else exitDrawMode();
          return;
        }
      }
      // Enter (or Escape) finishes choosing / a group selection. Skipped when a
      // button, link, select or menu has focus — there Enter has its own job.
      if (
        !e.ctrlKey &&
        !e.metaKey &&
        (e.key === "Enter" || e.key === "Escape") &&
        (chooseMode || hasGroupSelection)
      ) {
        if (e.target instanceof HTMLElement && e.target.closest("button, a, select, [role=menu]")) return;
        e.preventDefault();
        exitChooseMode();
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "c" || e.key === "C") {
        copySelection();
      } else if (e.key === "v" || e.key === "V") {
        // Not prevented: that would stop the browser's own paste event, the
        // only way a screenshot on the system clipboard ever reaches the page
        // (see onPaste below, and NodePanel's own paste handling). The node
        // paste runs from that event instead — or, should a browser fire no
        // paste event with nothing editable focused, from this fallback.
        window.clearTimeout(pasteFallback);
        pasteFallback = window.setTimeout(pasteClipboard, 150);
      }
    }
    // Ctrl/Cmd+V's real paste. A picture on the clipboard belongs to the open
    // node — NodePanel handles it first and marks the event handled; with no
    // such node there's nowhere to put it, so say so. Anything else pastes
    // the app's own copied nodes.
    function onPaste(e: ClipboardEvent) {
      window.clearTimeout(pasteFallback);
      if (e.defaultPrevented || isEditableTarget(e.target) || presenting || drawMode) return;
      if (imageFilesFrom(e.clipboardData).length > 0) {
        onImagePasteWithoutNode?.();
        return;
      }
      e.preventDefault();
      pasteClipboard();
    }
    let pasteFallback = 0;
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("paste", onPaste);
    return () => {
      window.clearTimeout(pasteFallback);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("paste", onPaste);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });
}
