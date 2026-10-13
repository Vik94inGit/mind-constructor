import { useState } from "react";
import type { FormEvent } from "react";
import { Modal } from "./Modal";
import { ApiRequestError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";

// Pick your own username. Opened by itself once after a first Google sign-in
// (prefilled with the name picked from the Google profile, or the email up to
// the @), and from the navbar any time after. Closing it without saving
// keeps the current name — that counts as choosing it, so it isn't offered
// again on the next page load.
export function UsernameModal({ onClose }: { onClose: () => void }) {
  const { user, updateUsername } = useAuth();
  const { t } = useI18n();
  const [name, setName] = useState(user?.username ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const firstTime = user?.usernameConfirmed === false;

  async function save(username: string) {
    setError(null);
    setBusy(true);
    try {
      await updateUsername(username);
      onClose();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.ui.username.failed);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void save(name.trim());
  }

  // Dismissing the first-time offer keeps the picked name for good.
  const keep = () => (firstTime && user ? void save(user.username) : onClose());

  return (
    <Modal title={t.ui.username.title} onClose={keep}>
      {firstTime && <p className="mb-4 text-[0.85rem] text-ink-soft">{t.ui.username.intro}</p>}
      {error && <div className="mb-4 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{error}</div>}
      <form onSubmit={onSubmit}>
        <div className="mb-4 flex flex-col gap-[0.35rem]">
          <label htmlFor="username-pick" className="text-[0.8rem] font-semibold text-ink-soft">
            {t.ui.username.label}
          </label>
          <input
            id="username-pick"
            required
            autoFocus
            minLength={2}
            maxLength={32}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-line bg-surface px-[0.7rem] py-[0.55rem] text-[0.92rem] font-[inherit] text-ink focus:outline focus:-outline-offset-1 focus:outline-2 focus:outline-accent"
          />
          <span className="text-[0.75rem] text-ink-soft">{t.ui.username.hint}</span>
        </div>
        <div className="mt-[1.2rem] flex justify-end gap-[0.6rem]">
          <button
            type="button"
            className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-4 py-[0.55rem] text-[0.88rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
            onClick={keep}
          >
            {firstTime ? t.ui.username.keep : t.ui.common.close}
          </button>
          <button
            type="submit"
            className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-accent bg-accent px-4 py-[0.55rem] text-[0.88rem] font-semibold text-white transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy || name.trim().length < 2}
          >
            {busy ? t.ui.username.saving : t.ui.username.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}
