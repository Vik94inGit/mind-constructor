import { usernameOf } from "../../utils/nodeType";
import type { Attack } from "../../types";
import { useI18n } from "../../i18n/I18nContext";

interface Props {
  /** null while it's still loading. */
  history: Attack[] | null;
}

// NodePanel's History tab: every attack this node has taken.
export function HistoryTab({ history }: Props) {
  const { t } = useI18n();
  return (
    <div className="mt-4">
      {history === null ? (
        <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>{t.ui.history.loading}</p>
      ) : history.length === 0 ? (
        <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>{t.ui.history.none}</p>
      ) : (
        history.map((a, i) => (
          <div className="flex justify-between border-b border-line py-[0.4rem] text-[0.8rem] last:border-b-0" key={i}>
            <span>
              {usernameOf(a.attackerId as any)} · {t.ui.attack.weapons[a.weapon]}
            </span>
            <span>-{a.damage}</span>
          </div>
        ))
      )}
    </div>
  );
}
