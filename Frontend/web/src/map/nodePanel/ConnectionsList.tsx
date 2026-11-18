import { useI18n } from "../../i18n/I18nContext";
import { nodeRefId } from "../../utils/nodeType";
import { readableText } from "../../utils/copyScopes";
import type { EdgeDoc, NodeDoc } from "../../types";

interface Props {
  node: NodeDoc;
  nodes: NodeDoc[];
  /** The link edges this node is on. */
  edges: EdgeDoc[];
  /** Whether this viewer may take this node off its parent (it is theirs). */
  canEditOwn: boolean;
  /** Whether this viewer may take a child off this node (theirs, or they own the map); the server still decides. */
  canEditChildren: boolean;
  busy: boolean;
  onSelectNode: (nodeId: string) => void;
  /** Takes `child` off its parent: it stays where it is, with no parent. */
  onUnhook: (child: NodeDoc) => void;
  onDeleteEdge: (edgeId: string) => void;
  /** Change parent: pick another node to hang this one from. */
  onChangeParent?: () => void;
}

const row = "flex items-center justify-between gap-2 border-b border-line py-[0.4rem] text-[0.8rem] last:border-b-0";
const nameBtn = "min-w-0 flex-1 cursor-pointer truncate bg-transparent p-0 text-left text-ink hover:underline";
const smallBtn =
  "inline-flex flex-shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent bg-transparent px-[0.55rem] py-[0.3rem] text-[0.78rem] font-semibold text-ink enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50";
const label = "mt-3 mb-1 text-[0.7rem] font-bold tracking-[0.03em] text-ink-soft uppercase";

// The History tab's list of everything this node is tied to: the parent it
// hangs from and the children hanging from it (the branch a zone is made
// of, set when the node was added to the zone) and its link edges. Each can
// be changed here: open the other node, change or drop the parent, take a
// child off, remove a link.
export function ConnectionsList({ node, nodes, edges, canEditOwn, canEditChildren, busy, onSelectNode, onUnhook, onDeleteEdge, onChangeParent }: Props) {
  const { t } = useI18n();
  const h = t.ui.history;
  const name = (n: NodeDoc | undefined) => {
    if (!n) return "…";
    const text = readableText(n.title || n.text || t.ui.types[n.type]).replace(/\s+/g, " ").trim();
    return text.length > 40 ? `${text.slice(0, 39)}…` : text;
  };
  const parentId = nodeRefId(node.parentId);
  const parent = parentId ? nodes.find((n) => n.nodeId === parentId) : undefined;
  const children = nodes.filter((n) => nodeRefId(n.parentId) === node.nodeId && !n.isWeapon && !n.isProtection);

  return (
    <section data-connections aria-label={h.connections}>
      <h3 className="m-0 mt-4 text-[0.85rem] font-semibold text-ink">{h.connections}</h3>

      <p className={label}>{h.parent}</p>
      {parent ? (
        <div className={row} data-connection="parent">
          <button type="button" className={nameBtn} onClick={() => onSelectNode(parent.nodeId)}>
            ↑ {name(parent)}
          </button>
          {canEditOwn && onChangeParent && (
            <button type="button" className={smallBtn} disabled={busy} onClick={onChangeParent}>
              {h.changeParent}
            </button>
          )}
          {canEditOwn && (
            <button
              type="button"
              className={smallBtn}
              disabled={busy}
              title={t.ui.contextMenu.unlinkFromParent(name(parent))}
              aria-label={t.ui.contextMenu.unlinkFromParent(name(parent))}
              onClick={() => onUnhook(node)}
            >
              ✕
            </button>
          )}
        </div>
      ) : (
        <div className={row}>
          <span className="text-ink-soft">{h.noParent}</span>
          {canEditOwn && onChangeParent && (
            <button type="button" className={smallBtn} disabled={busy} onClick={onChangeParent}>
              {h.pickParent}
            </button>
          )}
        </div>
      )}

      {children.length > 0 && (
        <>
          <p className={label}>{h.children(children.length)}</p>
          {children.map((c) => (
            <div className={row} key={c.nodeId} data-connection="child">
              <button type="button" className={nameBtn} onClick={() => onSelectNode(c.nodeId)}>
                ↓ {name(c)}
              </button>
              {canEditChildren && (
                <button
                  type="button"
                  className={smallBtn}
                  disabled={busy}
                  title={t.ui.contextMenu.unlinkChild(name(c))}
                  aria-label={t.ui.contextMenu.unlinkChild(name(c))}
                  onClick={() => onUnhook(c)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </>
      )}

      {edges.length > 0 && (
        <>
          <p className={label}>{h.links(edges.length)}</p>
          {edges.map((e) => {
            const fromId = nodeRefId(e.fromNodeId)!;
            const otherId = fromId === node.nodeId ? nodeRefId(e.toNodeId)! : fromId;
            const other = nodes.find((n) => n.nodeId === otherId);
            return (
              <div className={row} key={e.edgeId} data-connection="link">
                <button type="button" className={nameBtn} onClick={() => other && onSelectNode(other.nodeId)}>
                  {fromId === node.nodeId ? "→" : "←"} {name(other)}{" "}
                  <span className="text-[0.72rem] text-ink-soft">· {t.ui.sentiments[e.sentiment]}</span>
                </button>
                <button
                  type="button"
                  className={smallBtn}
                  disabled={busy}
                  title={t.ui.contextMenu.unlinkEdge(name(other))}
                  aria-label={t.ui.contextMenu.unlinkEdge(name(other))}
                  onClick={() => onDeleteEdge(e.edgeId)}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </>
      )}

      <h3 className="m-0 mt-5 text-[0.85rem] font-semibold text-ink">{h.attacks}</h3>
    </section>
  );
}
