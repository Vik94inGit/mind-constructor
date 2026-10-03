import { nodeRefId, ZONE_COLORS } from "../../utils/nodeType";
import { MANUAL_ZONE_COLORS, SIZE_TIERS } from "../../types";
import type { EdgeDoc, ManualZoneColor, NodeDoc, SizeTier, SymbolOverride } from "../../types";
import { useI18n } from "../../i18n/I18nContext";

// Same 100%/115%/130% scale NodeCard's own SIZE_MULTIPLIERS uses, just for
// the button labels here — kept as a separate literal rather than imported
// from NodeCard (a map component importing from another map component's
// internals isn't a pattern this codebase otherwise uses; this pairing is
// simple enough not to be worth a shared constants file).
const SIZE_TIER_LABEL: Record<SizeTier, string> = { 1: "100%", 2: "115%", 3: "130%" };

interface Props {
  node: NodeDoc;
  isCreator: boolean;
  isMapOwner: boolean;
  isClusterParent: boolean;
  /** Only an outcome type draws a symbol that can be overridden. */
  isOutcome: boolean;
  busy: boolean;
  /** A weapon node's target, a shield's protected node, and this node's own shields. */
  target: NodeDoc | undefined;
  protectedTarget: NodeDoc | undefined;
  protectors: NodeDoc[];
  connectedEdges: EdgeDoc[];
  nodeById: (id: string) => NodeDoc | undefined;
  titleDraft: string;
  setTitleDraft: (value: string) => void;
  zoneNameDraft: string;
  setZoneNameDraft: (value: string) => void;
  orderDraft: string;
  setOrderDraft: (value: string) => void;
  /** Each resolves true unless the save failed. */
  onTitleSave: () => Promise<boolean>;
  onZoneNameSave: () => Promise<boolean>;
  onOrderSave: () => Promise<boolean>;
  onToggleHidden: () => Promise<void>;
  onSetSize: (tier: SizeTier) => void;
  onSetZone: (zone: ManualZoneColor | null) => void;
  onSetSymbol: (symbol: SymbolOverride | null) => void;
  onDeleteEdge: (edgeId: string) => void;
  onSelectNode: (nodeId: string) => void;
  onEdit: () => void;
  onStartPack: () => void;
  onStartChoose: () => void;
  onExtractText: () => void;
  onClose: () => void;
}

// NodePanel's "Modify" tab: health, what a weapon/shield points at, the
// owner's title/zone name/step number/size/zone/symbol controls, branch
// visibility, choosing and packing, and this node's links.
export function ModifyTab({ node, isCreator, isMapOwner, isClusterParent, isOutcome, busy, target, protectedTarget, protectors, connectedEdges, nodeById, titleDraft, setTitleDraft, zoneNameDraft, setZoneNameDraft, orderDraft, setOrderDraft, onTitleSave, onZoneNameSave, onOrderSave, onToggleHidden, onSetSize, onSetZone, onSetSymbol, onDeleteEdge, onSelectNode, onEdit, onStartPack, onStartChoose, onExtractText, onClose }: Props) {
  const { t } = useI18n();
  return (
    <div className="mt-4">
      <div className="h-1 overflow-hidden rounded-[3px] bg-surface-2">
        <div
          className="h-full transition-[width] duration-200"
          style={{
            width: `${Math.max(0, node.health)}%`,
            background: node.defeated ? "var(--danger)" : "var(--success)",
          }}
        />
      </div>
      <p style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
        {t.ui.node.healthLine(node.health, node.defeated)}
      </p>

      {node.isWeapon && target && (
        <p style={{ fontSize: "0.8rem", marginTop: "0.4rem" }}>
          {t.ui.node.pointsAt}{" "}
          <a role="button" style={{ cursor: "pointer" }} onClick={() => onSelectNode(target.nodeId)}>
            {target.text.slice(0, 40)}
          </a>
        </p>
      )}

      {node.isProtection && protectedTarget && (
        <p style={{ fontSize: "0.8rem", marginTop: "0.4rem" }}>
          🛡️ {t.ui.node.protects}{" "}
          <a role="button" style={{ cursor: "pointer" }} onClick={() => onSelectNode(protectedTarget.nodeId)}>
            {protectedTarget.text.slice(0, 40)}
          </a>
        </p>
      )}

      {node.isProtection && !!node.blockedDamage && (
        <p style={{ fontSize: "0.78rem", marginTop: "0.3rem", color: "var(--ink-soft)" }}>
          {t.ui.node.blocked(node.blockedDamage, protectedTarget ? protectedTarget.text.slice(0, 30) : null)}
        </p>
      )}

      {protectors.length > 0 && (
        <p style={{ fontSize: "0.8rem", marginTop: "0.4rem" }}>
          🛡️ {t.ui.node.protectedBy}{" "}
          {protectors.map((p, i) => (
            <span key={p.nodeId}>
              {i > 0 && ", "}
              <a role="button" style={{ cursor: "pointer" }} onClick={() => onSelectNode(p.nodeId)}>
                {p.text.slice(0, 24)}
              </a>
            </span>
          ))}
        </p>
      )}

      {/* Optional title — what the canvas shows under the node instead of
          the start of the text. Saves on blur/Enter. */}
      {isCreator && (
        <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem", alignItems: "center" }}>
          <label htmlFor="node-title" style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
            {t.ui.node.title}
          </label>
          <input
            id="node-title"
            type="text"
            maxLength={80}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            disabled={busy}
            placeholder={t.ui.node.titlePlaceholder}
            onKeyDown={(e) => {
              // Enter saves, then closes the panel — editing is done.
              if (e.key === "Enter") {
                e.preventDefault();
                void onTitleSave().then((ok) => ok && onClose());
              }
            }}
            onBlur={() => void onTitleSave()}
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-[0.7rem] py-[0.35rem] text-[0.85rem] font-[inherit] text-ink placeholder:text-ink-soft focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      )}

      {/* Name of the zone this node is the parent of — shown under it on
          the canvas and on the minimap. Saves on blur/Enter. */}
      {isCreator && isClusterParent && (
        <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem", alignItems: "center" }}>
          <label htmlFor="node-zone-name" style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
            {t.ui.node.zoneName}
          </label>
          <input
            id="node-zone-name"
            type="text"
            maxLength={40}
            value={zoneNameDraft}
            onChange={(e) => setZoneNameDraft(e.target.value)}
            disabled={busy}
            placeholder={t.ui.node.zoneNamePlaceholder}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void onZoneNameSave().then((ok) => ok && onClose());
              }
            }}
            onBlur={() => void onZoneNameSave()}
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-[0.7rem] py-[0.35rem] text-[0.85rem] font-[inherit] text-ink placeholder:text-ink-soft focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      )}

      {/* The map owner can hide this whole branch from invited members. */}
      {isMapOwner && (
        <div className="mt-[0.6rem]">
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
            onClick={() => void onToggleHidden()}
          >
            {node.hiddenFromMembers ? t.ui.visibility.show : t.ui.visibility.hide}
          </button>
          <p className="mt-1 text-[0.72rem] text-ink-soft">{t.ui.visibility.hint}</p>
        </div>
      )}

      {/* Optional step number — a badge on the node, for describing a
          process by labeling nodes 1, 2, 3… Blank clears it. */}
      {isCreator && (
        <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem", alignItems: "center" }}>
          <label htmlFor="node-order" style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
            {t.ui.node.order}
          </label>
          <input
            id="node-order"
            type="number"
            inputMode="numeric"
            min={1}
            max={9999}
            step={1}
            value={orderDraft}
            onChange={(e) => setOrderDraft(e.target.value)}
            disabled={busy}
            placeholder={t.ui.node.orderPlaceholder}
            title={t.ui.node.orderTitle}
            onKeyDown={(e) => {
              // Enter saves, then closes the panel — same as the title.
              if (e.key === "Enter") {
                e.preventDefault();
                void onOrderSave().then((ok) => ok && onClose());
              }
            }}
            onBlur={() => void onOrderSave()}
            className="w-24 rounded-lg border border-line bg-surface px-[0.7rem] py-[0.35rem] text-[0.85rem] font-[inherit] text-ink placeholder:text-ink-soft focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      )}

      {isCreator && (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
          <button
            className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onEdit}
            title={t.ui.node.editTitle}
          >
            {t.ui.node.edit}
          </button>
          <button
            className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onStartPack}
            title={t.ui.node.packTitle}
          >
            {t.ui.node.pack}
          </button>
        </div>
      )}

      {isCreator && (
        <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>{t.ui.node.size}</span>
          {SIZE_TIERS.map((tier) => (
            <button
              key={tier}
              className={`inline-flex cursor-pointer items-center justify-center rounded-lg border px-[0.55rem] py-[0.3rem] text-[0.8rem] font-semibold transition-[background-color,border-color,opacity] duration-[120ms] disabled:cursor-not-allowed disabled:opacity-50 ${
                (node.sizeTier ?? 1) === tier
                  ? "border-accent bg-accent-soft text-accent-ink"
                  : "border-line bg-surface text-ink enabled:hover:bg-surface-2"
              }`}
              onClick={() => onSetSize(tier)}
              disabled={busy}
            >
              {SIZE_TIER_LABEL[tier]}
            </button>
          ))}
        </div>
      )}

      {isCreator && (
        <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>{t.ui.node.zone}</span>
          {MANUAL_ZONE_COLORS.map((z) => (
            <button
              key={z}
              className="inline-flex cursor-pointer items-center justify-center rounded-lg border px-[0.55rem] py-[0.3rem] text-[0.8rem] font-semibold capitalize transition-[background-color,border-color,opacity] duration-[120ms] disabled:cursor-not-allowed disabled:opacity-50"
              style={
                node.manualZone === z
                  ? {
                      borderColor: ZONE_COLORS[z],
                      // ZONE_COLORS is now a var(--zone-...) reference
                      // (see its own doc comment), not a bare hex
                      // literal — can't just append a hex alpha suffix
                      // to it like "26" any more, so color-mix does the
                      // same ~15% tint instead.
                      background: `color-mix(in srgb, ${ZONE_COLORS[z]} 15%, transparent)`,
                      color: ZONE_COLORS[z],
                    }
                  : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }
              }
              onClick={() => onSetZone(z)}
              disabled={busy}
              title={t.ui.node.zoneTitle(z)}
            >
              {t.ui.sentiments[z]}
            </button>
          ))}
          {node.manualZone && (
            <button
              className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-transparent bg-transparent px-[0.55rem] py-[0.3rem] text-[0.78rem] font-semibold text-ink-soft transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => onSetZone(null)}
              disabled={busy}
              title={t.ui.node.zoneRemoveTitle}
            >
              {t.ui.node.reset}
            </button>
          )}
        </div>
      )}

      {isCreator && isOutcome && (
        <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>{t.ui.node.symbol}</span>
          <button
            className={`inline-flex cursor-pointer items-center justify-center rounded-lg border px-[0.55rem] py-[0.3rem] text-[0.85rem] font-semibold transition-[background-color,border-color,opacity] duration-[120ms] disabled:cursor-not-allowed disabled:opacity-50 ${
              node.symbolOverride === "check"
                ? "border-accent bg-accent-soft text-accent-ink"
                : "border-line bg-surface text-ink enabled:hover:bg-surface-2"
            }`}
            onClick={() => onSetSymbol("check")}
            disabled={busy}
            title={t.ui.node.symbolCheckTitle}
          >
            ✓
          </button>
          <button
            className={`inline-flex cursor-pointer items-center justify-center rounded-lg border px-[0.55rem] py-[0.3rem] text-[0.85rem] font-semibold transition-[background-color,border-color,opacity] duration-[120ms] disabled:cursor-not-allowed disabled:opacity-50 ${
              node.symbolOverride === "cross"
                ? "border-accent bg-accent-soft text-accent-ink"
                : "border-line bg-surface text-ink enabled:hover:bg-surface-2"
            }`}
            onClick={() => onSetSymbol("cross")}
            disabled={busy}
            title={t.ui.node.symbolCrossTitle}
          >
            ✗
          </button>
          {node.symbolOverride && (
            <button
              className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-transparent bg-transparent px-[0.55rem] py-[0.3rem] text-[0.78rem] font-semibold text-ink-soft transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => onSetSymbol(null)}
              disabled={busy}
              title={t.ui.node.symbolResetTitle}
            >
              {t.ui.node.reset}
            </button>
          )}
        </div>
      )}

      {isCreator && (
        <div className="mt-4 border-t border-line pt-4">
          <button
            className="inline-flex w-full cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onStartChoose}
            title={t.ui.node.chooseNodesTitle}
          >
            {t.ui.node.chooseNodes}
          </button>
        </div>
      )}
      {connectedEdges.length === 0 ? (
        <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)", marginTop: "0.5rem" }}>{t.ui.node.noLinks}</p>
      ) : (
        <div style={{ marginTop: "0.5rem" }}>
          {connectedEdges.map((e) => {
            const fromId = nodeRefId(e.fromNodeId)!;
            const toId = nodeRefId(e.toNodeId)!;
            const otherId = fromId === node.nodeId ? toId : fromId;
            const other = nodeById(otherId);
            const dir = fromId === node.nodeId ? "→" : "←";
            return (
              <div className="flex items-center justify-between py-[0.35rem] text-[0.8rem]" key={e.edgeId}>
                <span>
                  <span
                    className="inline-flex items-center gap-1 rounded-[20px] border border-line bg-surface-2 px-[0.55rem] py-[0.2rem] text-[0.72rem] text-ink-soft"
                    style={{
                      color:
                        e.sentiment === "negative"
                          ? "var(--danger)"
                          : e.sentiment === "positive"
                            ? "var(--success)"
                            : "var(--ink-soft)",
                    }}
                  >
                    {t.ui.sentiments[e.sentiment]}
                  </span>{" "}
                  {dir} {other ? other.text.slice(0, 24) : "…"}
                </span>
                <button
                  className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-transparent bg-transparent px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => onDeleteEdge(e.edgeId)}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {isClusterParent && (
        <div className="mt-4 border-t border-line pt-4">
          <button
            className="inline-flex w-full cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onExtractText}
            title={t.ui.node.extractTextTitle}
          >
            {t.ui.node.extractText}
          </button>
        </div>
      )}
    </div>
  );
}
