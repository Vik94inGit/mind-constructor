import { useEffect, useRef, useState } from "react";
import type { NodeDoc, NodeType } from "../types";

interface Params {
  node: NodeDoc;
  inlineEditing?: boolean;
  /** Fired once on blur/Enter with a non-empty, actually-changed draft. */
  onInlineConfirm?: (text: string, type: NodeType) => void;
  /** Fired on Escape, or on blur/Enter when the draft is empty or unchanged. */
  onInlineCancel?: () => void;
}

// NodeCard's inline text/type editor: the draft being typed, and the one place
// that decides whether finishing it saves or cancels.
export function useInlineEditDraft({ node, inlineEditing, onInlineConfirm, onInlineCancel }: Params) {
  // Reset from the node's real text/type every time editing turns on, so
  // re-opening it after a cancel (or after someone else's edit landed) always
  // starts from what's actually saved.
  const [draftText, setDraftText] = useState(node.text);
  const [draftType, setDraftType] = useState<NodeType>(node.type);
  // Escape needs to blur the input *without* the resulting blur treating
  // that as a confirm — this flag is the one thing both handlers share, so
  // there's a single place (handleBlur) that actually decides what happens,
  // regardless of which path (Enter, Escape, clicking away) triggered it.
  const cancelingRef = useRef(false);

  useEffect(() => {
    if (inlineEditing) {
      setDraftText(node.text);
      setDraftType(node.type);
      cancelingRef.current = false;
    }
  }, [inlineEditing, node.text, node.type]);

  // Single resolution point for the inline editor, however it was reached.
  function resolveInlineEdit() {
    if (cancelingRef.current) {
      cancelingRef.current = false;
      onInlineCancel?.();
      return;
    }
    const trimmed = draftText.trim();
    if (!trimmed || (trimmed === node.text && draftType === node.type)) {
      onInlineCancel?.();
      return;
    }
    onInlineConfirm?.(trimmed, draftType);
  }

  // Escape: blur without the blur counting as a confirm.
  function markCanceling() {
    cancelingRef.current = true;
  }

  return { draftText, setDraftText, draftType, setDraftType, resolveInlineEdit, markCanceling };
}
