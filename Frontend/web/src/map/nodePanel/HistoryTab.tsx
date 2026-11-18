import { usernameOf } from "../../utils/nodeType";
import type { Attack } from "../../types";
import { useI18n } from "../../i18n/I18nContext";
import type { ReactNode } from "react";

interface Props {
  /** null while it's still loading. */
  history: Attack[] | null;
  /** What the node is tied to, listed above its attacks (ConnectionsList). */
  connections?: ReactNode;
}

// NodePanel's History tab: what the node is tied to, then every attack it has taken.
export function HistoryTab({ history, connections }: Props) {
  const { t } = useI18n();
  return (
    <div className={connections ? "" : "mt-4"}>
      {connections}
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
