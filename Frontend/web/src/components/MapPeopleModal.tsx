import { Modal } from "./Modal";
import { useI18n } from "../i18n/I18nContext";
import type { MapDoc } from "../types";

interface Props {
  map: MapDoc;
  /** Which of a map card's two buttons opened this. */
  view: "members" | "owner";
  /** The signed-in user's own id, to mark "you" in the list. */
  currentUserId: string | undefined;
  onClose: () => void;
}

// Who is on a map — its members, or just its owner. Everything shown comes
// with the maps list itself (ownerName / memberNames — see the backend's
// getMapsDao), so this opens instantly with nothing to fetch.
export function MapPeopleModal({ map, view, currentUserId, onClose }: Props) {
  const { t } = useI18n();
  const isYou = map.ownerId === currentUserId;
  const ownerName = map.ownerName ?? t.ui.people.unknown;
  const members = map.memberNames ?? [];
  const chip =
    "inline-flex items-center rounded-[20px] border border-line bg-surface-2 px-[0.55rem] py-[0.15rem] text-[0.7rem] font-semibold text-ink-soft";

  return (
    <Modal title={view === "owner" ? t.ui.people.ownerTitle(map.name) : t.ui.people.membersTitle(map.name)} onClose={onClose}>
      {view === "owner" ? (
        <p className="m-0 flex items-center gap-[0.5rem] text-[0.95rem] text-ink">
          <span className="font-semibold">{ownerName}</span>
          {isYou && <span className={chip}>{t.ui.people.you}</span>}
        </p>
      ) : members.length === 0 ? (
        <p className="m-0 text-[0.85rem] text-ink-soft">{t.ui.people.noMembers}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-[0.4rem] p-0">
          {members.map((name, i) => (
            <li key={`${name}-${i}`} className="flex items-center gap-[0.5rem] text-[0.92rem] text-ink">
              <span>{name}</span>
              {name === map.ownerName && <span className={chip}>{t.ui.people.owner}</span>}
              {name === map.ownerName && isYou && <span className={chip}>{t.ui.people.you}</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-[1.2rem] flex justify-end">
        <button
          type="button"
          className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-4 py-[0.55rem] text-[0.88rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2"
          onClick={onClose}
        >
          {t.ui.common.close}
        </button>
      </div>
    </Modal>
  );
}
