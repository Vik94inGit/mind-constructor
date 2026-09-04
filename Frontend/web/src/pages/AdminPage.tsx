import { useEffect, useState } from "react";
import * as authApi from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { ApiRequestError } from "../api/client";
import type { User } from "../types";

export function AdminPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setUsers(await authApi.listUsers());
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleBlock(u: User) {
    setBusyId(u._id);
    setError(null);
    try {
      const updated = u.isBlocked ? await authApi.unblockUser(u._id) : await authApi.blockUser(u._id);
      setUsers((prev) => prev.map((x) => (x._id === u._id ? updated : x)));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(u: User) {
    if (!confirm(`Delete ${u.username}? This deletes every map they own.`)) return;
    setBusyId(u._id);
    setError(null);
    try {
      await authApi.deleteUser(u._id);
      setUsers((prev) => prev.filter((x) => x._id !== u._id));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  async function wipe() {
    if (!confirm("Wipe the ENTIRE database — all users, maps and nodes? This cannot be undone.")) return;
    if (!confirm("Are you absolutely sure? Type-of-no-return confirmation #2.")) return;
    setError(null);
    try {
      await authApi.wipeDatabase();
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Wipe failed");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1080px] px-6 pt-8 pb-16">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-bold">Admin</h1>
          <p className="mt-[0.2rem] mb-0 text-[0.9rem] text-ink-soft">Manage every registered user.</p>
        </div>
        <button
          className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-danger-bg bg-danger-bg px-4 py-[0.55rem] text-[0.88rem] font-semibold text-danger transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={wipe}
        >
          Wipe database
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{error}</div>
      )}

      {loading ? (
        <div className="p-12 text-center text-ink-soft">Loading users…</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="w-full overflow-hidden rounded-card border border-line bg-surface" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th className="border-b border-line bg-surface-2 px-[0.85rem] py-[0.65rem] text-left text-[0.7rem] font-semibold tracking-[0.05em] text-ink-soft uppercase">
                  Username
                </th>
                <th className="border-b border-line bg-surface-2 px-[0.85rem] py-[0.65rem] text-left text-[0.7rem] font-semibold tracking-[0.05em] text-ink-soft uppercase">
                  Email
                </th>
                <th className="border-b border-line bg-surface-2 px-[0.85rem] py-[0.65rem] text-left text-[0.7rem] font-semibold tracking-[0.05em] text-ink-soft uppercase">
                  Role
                </th>
                <th className="border-b border-line bg-surface-2 px-[0.85rem] py-[0.65rem] text-left text-[0.7rem] font-semibold tracking-[0.05em] text-ink-soft uppercase">
                  Status
                </th>
                <th className="border-b border-line bg-surface-2 px-[0.85rem] py-[0.65rem] text-left text-[0.7rem] font-semibold tracking-[0.05em] text-ink-soft uppercase"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => {
                const isSelf = u._id === me?._id;
                const last = i === users.length - 1;
                const cell = `px-[0.85rem] py-[0.65rem] text-[0.85rem]${last ? "" : " border-b border-line"}`;
                return (
                  <tr key={u._id}>
                    <td className={cell}>{u.username}</td>
                    <td className={cell}>{u.email}</td>
                    <td className={cell}>
                      {u.role === "admin" && (
                        <span className="rounded-[5px] bg-accent-soft px-2 py-[0.15rem] text-[0.7rem] font-bold text-accent-ink">
                          admin
                        </span>
                      )}
                    </td>
                    <td className={cell}>
                      {u.isBlocked ? (
                        <span className="rounded-[5px] bg-danger-bg px-2 py-[0.15rem] text-[0.7rem] font-bold text-danger">
                          blocked
                        </span>
                      ) : (
                        <span className="rounded-[5px] bg-success-bg px-2 py-[0.15rem] text-[0.7rem] font-bold text-success">
                          active
                        </span>
                      )}
                    </td>
                    <td className={cell}>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <button
                          className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isSelf || busyId === u._id}
                          onClick={() => toggleBlock(u)}
                        >
                          {u.isBlocked ? "Unblock" : "Block"}
                        </button>
                        <button
                          className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-danger-bg bg-danger-bg px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-danger transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isSelf || busyId === u._id}
                          onClick={() => remove(u)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
