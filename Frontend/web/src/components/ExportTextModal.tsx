import { useState } from "react";
import { Modal } from "./Modal";
import { buildTreeExport } from "../utils/textExport";
import type { NodeDoc } from "../types";

interface Props {
  mapName: string;
  nodes: NodeDoc[];
  positions: Map<string, { x: number; y: number }>;
  onClose: () => void;
}

// A plain-text/markdown dump of the map's own branch tree (see
// buildTreeExport's own doc comment for exactly what this does and doesn't
// include), read-only and just sitting there to copy or download — no live
// editing, no persistence, purely a one-off export computed fresh from
// whatever MapPage already has loaded.
export function ExportTextModal({ mapName, nodes, positions, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const text = buildTreeExport(nodes, positions);

  // Same pattern NodePanel's own Copy button already uses — a transient
  // confirmation on success, a real error message (not a silent no-op) if
  // the browser blocks clipboard access outright.
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopyError(null);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyError("Copy failed — this browser blocked clipboard access.");
    }
  }

  // A plain client-side Blob download — no server round-trip, since
  // everything this needs (nodes/positions) is already sitting in MapPage's
  // own state.
  function handleDownload() {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${mapName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "map"}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal title={`Export text — "${mapName}"`} onClose={onClose}>
      {copyError && (
        <div className="mb-4 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{copyError}</div>
      )}
      <textarea
        readOnly
        value={text}
        rows={14}
        onFocus={(e) => e.currentTarget.select()}
        className="max-h-[50vh] w-full resize-y rounded-lg border border-line bg-surface-2 px-[0.7rem] py-[0.55rem] font-mono text-[0.78rem] leading-relaxed text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent"
      />
      <div className="mt-[1.2rem] flex flex-wrap justify-end gap-[0.6rem]">
        <button
          type="button"
          className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-4 py-[0.55rem] text-[0.88rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2"
          onClick={handleDownload}
        >
          Download .md
        </button>
        <button
          type="button"
          className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-4 py-[0.55rem] text-[0.88rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2"
          onClick={handleCopy}
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
        <button
          type="button"
          className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-accent bg-accent px-4 py-[0.55rem] text-[0.88rem] font-semibold text-white transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:opacity-90"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
