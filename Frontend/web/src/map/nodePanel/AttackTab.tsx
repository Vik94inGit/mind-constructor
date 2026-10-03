import { WEAPONS, WEAPON_INFO } from "../../types";
import type { NodeDoc, NodeType, Weapon } from "../../types";
import { useI18n } from "../../i18n/I18nContext";

interface Props {
  node: NodeDoc;
  busy: boolean;
  protectors: NodeDoc[];
  attackText: string;
  setAttackText: (text: string) => void;
  /** The node types this attack may carry, and the one currently picked. */
  attackTypes: NodeType[];
  effectiveAttackType: NodeType;
  setAttackType: (type: NodeType) => void;
  attackHint: string | null;
  onAttack: (weapon: Weapon) => void;
}

// NodePanel's Attack tab: write the objection, pick which node type it lands
// as, then fire one of the weapons.
export function AttackTab({ node, busy, protectors, attackText, setAttackText, attackTypes, effectiveAttackType, setAttackType, attackHint, onAttack }: Props) {
  const { t } = useI18n();
  return (
    <div className="mt-4">
      <p style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
        {t.ui.attack.intro}
        {node.isWeapon && t.ui.attack.introWeapon}
        {protectors.length > 0 && t.ui.attack.introShielded}
      </p>
      <div className="mb-4 flex flex-col gap-[0.35rem]">
        <label htmlFor="attack-text" className="text-[0.8rem] font-semibold text-ink-soft">
          {t.ui.attack.objection}
        </label>
        <textarea
          id="attack-text"
          rows={2}
          value={attackText}
          onChange={(e) => setAttackText(e.target.value)}
          placeholder={t.ui.attack.placeholder}
          className="rounded-lg border border-line bg-surface px-[0.7rem] py-[0.55rem] text-[0.92rem] font-[inherit] text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent"
        />
      </div>
      <div className="mb-4 flex flex-col gap-[0.35rem]">
        <label htmlFor="attack-type" className="text-[0.8rem] font-semibold text-ink-soft">
          {t.ui.attack.as}
        </label>
        <select
          id="attack-type"
          value={effectiveAttackType}
          onChange={(e) => setAttackType(e.target.value as NodeType)}
          className="rounded-lg border border-line bg-surface px-[0.7rem] py-[0.55rem] text-[0.92rem] font-[inherit] text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent"
        >
          {attackTypes.map((ty) => (
            <option key={ty} value={ty}>
              {t.ui.types[ty]}
            </option>
          ))}
        </select>
        {attackHint && <p className="text-[0.75rem] text-ink-soft">{attackHint}</p>}
      </div>
      {!attackText.trim() && (
        <p style={{ fontSize: "0.78rem", color: "var(--accent)", fontWeight: 600 }}>
          {t.ui.attack.writeObjection}
        </p>
      )}
      <div className="flex flex-col gap-2">
        {WEAPONS.map((w) => {
          const info = WEAPON_INFO[w];
          const needsText = !attackText.trim();
          return (
            <button
              key={w}
              className="inline-flex w-full cursor-pointer items-center justify-between gap-[0.4rem] rounded-lg border border-line bg-surface px-4 py-[0.55rem] text-[0.88rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy || needsText}
              title={needsText ? t.ui.attack.writeFirst : undefined}
              onClick={() => onAttack(w)}
            >
              <span>
                {t.ui.attack.weapons[w]} (-{info.damage})
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
