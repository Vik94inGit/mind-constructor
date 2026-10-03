import { usernameOf } from "../../utils/nodeType";
import { PROTECT_NODE_TYPES } from "../../types";
import type { AttackNodeType, NodeDoc } from "../../types";
import { useI18n } from "../../i18n/I18nContext";

interface Props {
  node: NodeDoc;
  isCreator: boolean;
  busy: boolean;
  protectText: string;
  setProtectText: (text: string) => void;
  protectType: AttackNodeType;
  setProtectType: (type: AttackNodeType) => void;
  onProtect: () => void;
}

// NodePanel's Protect tab: the node's owner adds a shield node in front of it.
export function ProtectTab({ node, isCreator, busy, protectText, setProtectText, protectType, setProtectType, onProtect }: Props) {
  const { t } = useI18n();
  return (
    <div className="mt-4">
      {isCreator ? (
        <>
          <p style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
            {t.ui.protect.intro}
          </p>
          <div className="mb-4 flex flex-col gap-[0.35rem]">
            <label htmlFor="protect-text" className="text-[0.8rem] font-semibold text-ink-soft">
              {t.ui.protect.why}
            </label>
            <textarea
              id="protect-text"
              rows={2}
              value={protectText}
              onChange={(e) => setProtectText(e.target.value)}
              placeholder={t.ui.protect.placeholder}
              className="rounded-lg border border-line bg-surface px-[0.7rem] py-[0.55rem] text-[0.92rem] font-[inherit] text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent"
            />
          </div>
          <div className="mb-4 flex flex-col gap-[0.35rem]">
            <label htmlFor="protect-type" className="text-[0.8rem] font-semibold text-ink-soft">
              {t.ui.protect.as}
            </label>
            <select
              id="protect-type"
              value={protectType}
              onChange={(e) => setProtectType(e.target.value as AttackNodeType)}
              className="rounded-lg border border-line bg-surface px-[0.7rem] py-[0.55rem] text-[0.92rem] font-[inherit] text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent"
            >
              {PROTECT_NODE_TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t.ui.types[ty]}
                </option>
              ))}
            </select>
          </div>
          <button
            className="inline-flex w-full cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-accent bg-accent px-[0.65rem] py-[0.55rem] text-[0.88rem] font-semibold text-white transition-opacity duration-[120ms] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={busy || !protectText.trim()}
            title={!protectText.trim() ? t.ui.protect.writeFirst : undefined}
            onClick={onProtect}
          >
            🛡️ {t.ui.protect.add}
          </button>
        </>
      ) : (
        <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
          {t.ui.protect.onlyOwner(usernameOf(node.userId as any))}
        </p>
      )}
    </div>
  );
}
