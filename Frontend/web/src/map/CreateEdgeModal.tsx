import { useState } from "react";
import type { FormEvent } from "react";
import { Modal } from "../components/Modal";
import { ApiRequestError } from "../api/client";
import * as edgesApi from "../api/edges";
import type { EdgeDoc, EdgeSentiment, NodeDoc } from "../types";

// `nodes` is the ordered pick list from the canvas's multi-select link
// picker — 2 nodes is the classic "link A to B" case (one edge, a line).
// 3+ links every consecutive pair *and* closes the loop back to the first
// node, so picking three or more nodes always finishes as a closed figure,
// not an open chain — that's what MapPage's cycle detector then colors in.
export function CreateEdgeModal({
  mapId,
  nodes,
  onClose,
  onCreated,
}: {
  mapId: string;
  nodes: NodeDoc[];
  onClose: () => void;
  onCreated: (edges: EdgeDoc[]) => void;
}) {
  const [sentiment, setSentiment] = useState<EdgeSentiment>("neutral");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pairs: [NodeDoc, NodeDoc][] = nodes.slice(1).map((n, i) => [nodes[i], n]);
  if (nodes.length >= 3) pairs.push([nodes[nodes.length - 1], nodes[0]]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // Sequential, not Promise.all: if one link in the chain fails partway
      // (e.g. a race with someone deleting a node), the error should say
      // which pair it stopped on rather than leaving a half-applied batch
      // racing itself.
      const created: EdgeDoc[] = [];
      for (const [from, to] of pairs) {
        created.push(
          await edgesApi.createEdge(mapId, { fromNodeId: from.nodeId, toNodeId: to.nodeId, sentiment }),
        );
      }
      onCreated(created);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to create link");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={nodes.length > 2 ? `Link ${nodes.length} nodes` : "Link nodes"} onClose={onClose}>
      {error && (
        <div className="mb-4 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{error}</div>
      )}
      <p className="text-[0.85rem] text-ink-soft">
        {nodes.map((n) => n.text.slice(0, 24)).join(" → ")}
        {nodes.length > 2 && ` → ${nodes[0].text.slice(0, 24)}`}
      </p>
      <form onSubmit={onSubmit}>
        <div className="mb-4 flex flex-col gap-[0.35rem]">
          <label htmlFor="edge-sentiment" className="text-[0.8rem] font-semibold text-ink-soft">
            Sentiment
          </label>
          <select
            id="edge-sentiment"
            value={sentiment}
            onChange={(e) => setSentiment(e.target.value as EdgeSentiment)}
            className="rounded-lg border border-line bg-surface px-[0.7rem] py-[0.55rem] text-[0.92rem] font-[inherit] text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent"
          >
            <option value="neutral">Neutral</option>
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
          </select>
        </div>
        <div className="mt-[1.2rem] flex justify-end gap-[0.6rem]">
          <button
            type="button"
            className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-4 py-[0.55rem] text-[0.88rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-accent bg-accent px-4 py-[0.55rem] text-[0.88rem] font-semibold text-white transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
          >
            {busy ? "Linking…" : pairs.length > 1 ? `Create ${pairs.length} links` : "Create link"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
