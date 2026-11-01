import { useEffect, useRef, useState } from "react";
import * as nodesApi from "../../api/nodes";
import type { NodeDoc } from "../../types";
import { MAX_NODE_IMAGES, imageFilesFrom, makeCardImage, makeIconImage, shrinkImage } from "../../utils/images";
import type { Translation } from "../../i18n/translations";

interface Options {
  node: NodeDoc;
  /** Only the node's creator may change its pictures. */
  canEdit: boolean;
  t: Translation;
  /** NodePanel's busy/error wrapper: runs the action and shows `fallback` if it throws. */
  run: (fallback: string, action: () => Promise<unknown>) => Promise<boolean>;
  setError: (error: string | null) => void;
  onUpdated: (node: NodeDoc) => void;
  /** A screenshot was pasted while the panel is open: show the Info tab. */
  onPasted: () => void;
}

/**
 * A node's pictures in the node panel. The map's node list leaves them out
 * (like text), so unless the node already carries them (just edited here,
 * or came in over the socket) they're fetched with the single node on open;
 * `images` is null while that fetch is in flight.
 */
export function useNodeImages({ node, canEdit, t, run, setError, onUpdated, onPasted }: Options) {
  const [images, setImages] = useState<string[] | null>(node.images ?? null);

  useEffect(() => {
    if (node.images) {
      setImages(node.images);
      return;
    }
    let cancelled = false;
    setImages(null);
    nodesApi
      .getNode(node.nodeId)
      .then((full) => !cancelled && setImages(full.images ?? []))
      .catch(() => !cancelled && setImages([]));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.nodeId]);
  useEffect(() => {
    if (node.images) setImages(node.images);
  }, [node.images]);

  // The whole list is saved in one PATCH.
  async function save(next: string[]) {
    const updated = await nodesApi.updateNode(node.nodeId, { images: next });
    setImages(updated.images ?? next);
    onUpdated(updated);
  }

  // Each picture is shrunk first (utils/images.ts); past the limit the rest are dropped.
  async function add(files: File[]) {
    if (!canEdit || images === null) return;
    const room = MAX_NODE_IMAGES - images.length;
    if (room <= 0) {
      setError(t.ui.images.limit(MAX_NODE_IMAGES));
      return;
    }
    await run(t.ui.images.failed, async () => {
      const added: string[] = [];
      for (const file of files.slice(0, room)) {
        try {
          added.push(await shrinkImage(file));
        } catch {
          setError(t.ui.images.tooLarge);
        }
      }
      if (files.length > room) setError(t.ui.images.limit(MAX_NODE_IMAGES));
      if (added.length) await save([...images, ...added]);
    });
  }

  function remove(index: number) {
    if (!canEdit || images === null) return;
    void run(t.ui.images.failed, () => save(images.filter((_, i) => i !== index)));
  }

  // A picture is the node's icon (a small square cut from it) or its card on
  // the map, never both, so choosing one takes the other off. null goes back
  // to the type's symbol / no card.
  function setAs(kind: "iconImage" | "cardImage", index: number | null) {
    const src = index == null ? "" : images?.[index];
    if (src == null) return;
    const other = kind === "iconImage" ? "cardImage" : "iconImage";
    void run(t.ui.images.iconFailed, async () => {
      const image = src ? await (kind === "iconImage" ? makeIconImage(src) : makeCardImage(src)) : "";
      onUpdated(await nodesApi.updateNode(node.nodeId, image ? { [kind]: image, [other]: "" } : { [kind]: image }));
    });
  }

  // A screenshot pasted while the panel is open lands on the node even when
  // nothing in the panel has focus (the usual case: a node was just clicked
  // on the canvas). A paste inside the panel goes through onPanelPaste, and
  // one into some other text field is left to it.
  const addRef = useRef(add);
  addRef.current = add;
  const onPastedRef = useRef(onPasted);
  onPastedRef.current = onPasted;
  useEffect(() => {
    if (!canEdit) return;
    function onDocumentPaste(e: ClipboardEvent) {
      if (e.defaultPrevented) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const files = imageFilesFrom(e.clipboardData);
      if (files.length === 0) return;
      e.preventDefault();
      onPastedRef.current();
      void addRef.current(files);
    }
    document.addEventListener("paste", onDocumentPaste);
    return () => document.removeEventListener("paste", onDocumentPaste);
  }, [canEdit]);

  // A screenshot pasted anywhere in the panel (its text field included);
  // pasting plain text is left alone.
  function onPanelPaste(e: React.ClipboardEvent) {
    if (!canEdit) return;
    const files = imageFilesFrom(e.clipboardData);
    if (files.length === 0) return;
    e.preventDefault();
    onPasted();
    void add(files);
  }

  return { images, add, remove, setAs, onPanelPaste };
}
