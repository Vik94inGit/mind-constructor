import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { connectSocket } from "../api/socket";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";

interface Invite {
  mapId: string;
  name: string;
  invitedBy: string;
}

// The moment someone invites you to a map, whatever page you have open: a
// small card in the corner with a way straight in (Backend's notifyUser
// sends "map:invited" to every socket the invitee has open). The dashboard
// listens for the same event to add the map to its list.
export function InviteNotice() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<Invite | null>(null);

  useEffect(() => {
    if (!user) return;
    const socket = connectSocket();
    const onInvited = (payload: Invite) => setInvite(payload);
    socket.on("map:invited", onInvited);
    return () => {
      socket.off("map:invited", onInvited);
    };
  }, [user?._id]);

  if (!invite) return null;

  return (
    <div
      role="status"
      className="fixed right-4 bottom-4 z-50 flex max-w-[min(360px,calc(100vw-2rem))] items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 text-[0.88rem] text-ink shadow-card"
    >
      <span className="min-w-0 flex-1">{t.ui.invite.notice(invite.invitedBy, invite.name)}</span>
      <button
        type="button"
        className="shrink-0 cursor-pointer rounded-lg border border-accent bg-accent px-3 py-[0.35rem] text-[0.8rem] font-semibold text-white hover:opacity-90"
        onClick={() => {
          setInvite(null);
          navigate(`/maps/${invite.mapId}`);
        }}
      >
        {t.ui.invite.open}
      </button>
      <button
        type="button"
        aria-label={t.ui.invite.dismiss}
        className="shrink-0 cursor-pointer rounded-md px-1 text-ink-soft hover:text-ink"
        onClick={() => setInvite(null)}
      >
        ×
      </button>
    </div>
  );
}
