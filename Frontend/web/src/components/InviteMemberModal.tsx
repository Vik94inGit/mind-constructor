import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import * as mapsApi from "../api/maps";
import * as authApi from "../api/auth";
import { Modal } from "./Modal";
import { ApiRequestError } from "../api/client";
import type { MapDoc, User } from "../types";

export function InviteMemberModal({
  map,
  onClose,
  onInvited,
}: {
  map: MapDoc;
  onClose: () => void;
  onInvited?: (map: MapDoc) => void;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const memberIds = new Set(
    Array.isArray(map.members) ? map.members.map((m) => (typeof m === "string" ? m : m._id)) : [],
  );

  useEffect(() => {
    authApi.listUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  const candidates = users.filter((u) => !memberIds.has(u._id));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const updated = await mapsApi.inviteMember(map.mapId, selected);
      const invited = users.find((u) => u._id === selected);
      setSuccess(`${invited?.username ?? "User"} invited.`);
      setSelected("");
      onInvited?.(updated);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to invite");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Invite to "${map.name}"`} onClose={onClose}>
      {error && <div className="mb-4 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{error}</div>}
      {success && (
        <div className="mb-4 rounded-lg bg-success-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-success">{success}</div>
      )}
      {candidates.length === 0 ? (
        <p className="text-[0.85rem] text-ink-soft">Everyone is already a member.</p>
      ) : (
        <form onSubmit={onSubmit}>
          <div className="mb-4 flex flex-col gap-[0.35rem]">
            <label htmlFor="invite-user" className="text-[0.8rem] font-semibold text-ink-soft">
              User
            </label>
            <select
              id="invite-user"
              required
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="rounded-lg border border-line bg-surface px-[0.7rem] py-[0.55rem] text-[0.92rem] font-[inherit] text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent"
            >
              <option value="" disabled>
                Choose a user…
              </option>
              {candidates.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.username} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <div className="mt-[1.2rem] flex justify-end gap-[0.6rem]">
            <button
              type="button"
              className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-4 py-[0.55rem] text-[0.88rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="submit"
              className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-accent bg-accent px-4 py-[0.55rem] text-[0.88rem] font-semibold text-white transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy || !selected}
            >
              {busy ? "Inviting…" : "Invite"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
