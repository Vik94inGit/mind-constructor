import type { NodeDoc } from "../../types";
import { useI18n } from "../../i18n/I18nContext";

interface Props {
  packedMembers: NodeDoc[];
  busy: boolean;
  onUnpack: (memberId: string) => void;
}

// NodePanel's Packed tab: every node packed into this one, each with Unpack.
export function PackedTab({ packedMembers, busy, onUnpack }: Props) {
  const { t } = useI18n();
  return (
    <div className="mt-4">
      {packedMembers.length === 0 ? (
        <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>{t.ui.packed.empty}</p>
      ) : (
        <div style={{ marginTop: "0.5rem" }}>
          {packedMembers.map((m) => (
            <div className="flex items-center justify-between py-[0.35rem] text-[0.8rem]" key={m.nodeId}>
              <span className="min-w-0 truncate">{m.text.slice(0, 40)}</span>
              <button
                className="inline-flex flex-shrink-0 cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.55rem] py-[0.25rem] text-[0.76rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => onUnpack(m.nodeId)}
                disabled={busy}
              >
                {t.ui.packed.unpack}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
