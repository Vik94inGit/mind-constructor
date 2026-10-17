import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useI18n } from "../i18n/I18nContext";

export interface ConfirmOptions {
  /** The confirm button's words — the plain "OK" when unset. */
  confirmLabel?: string;
  /** A destructive step (deleting, wiping): the confirm button is drawn red. */
  danger?: boolean;
}

export type Confirm = (message: string, options?: ConfirmOptions) => Promise<boolean>;

// Outside a ConfirmProvider (a hook under test) the browser's own dialog
// answers, so callers never need to know which one they got.
const ConfirmContext = createContext<Confirm>((message) => Promise.resolve(window.confirm(message)));

/** Asks a yes/no question in the app's own dialog; resolves true for yes. */
export function useConfirm(): Confirm {
  return useContext(ConfirmContext);
}

interface Pending extends ConfirmOptions {
  message: string;
  resolve: (ok: boolean) => void;
}

// The app's own confirm dialog, in place of the browser's: it matches the app,
// speaks the user's language on both buttons, and can say "Delete" instead of
// "OK". Enter confirms, Escape or a tap outside cancels.
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [pending, setPending] = useState<Pending | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  const confirm = useCallback<Confirm>(
    (message, options = {}) =>
      new Promise<boolean>((resolve) => {
        setPending((prev) => {
          // A second question while one is open: the first counts as "no".
          prev?.resolve(false);
          return { message, ...options, resolve };
        });
      }),
    [],
  );

  const answer = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok);
      setPending(null);
    },
    [pending],
  );

  useEffect(() => {
    if (!pending) return;
    confirmRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        answer(false);
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [pending, answer]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(10,12,18,0.45)] p-4"
          onMouseDown={(e) => e.target === e.currentTarget && answer(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-describedby="confirm-message"
            className="w-full max-w-[380px] rounded-card border border-line bg-surface p-5 shadow-card"
          >
            <p id="confirm-message" className="mb-5 text-[0.95rem] whitespace-pre-line text-ink">
              {pending.message}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="cursor-pointer rounded-lg border border-line bg-surface px-4 py-2 text-[0.85rem] font-semibold text-ink hover:bg-surface-2"
                onClick={() => answer(false)}
              >
                {t.ui.common.cancel}
              </button>
              <button
                ref={confirmRef}
                type="button"
                className={`cursor-pointer rounded-lg border-0 px-4 py-2 text-[0.85rem] font-semibold text-white ${
                  pending.danger ? "bg-danger hover:opacity-90" : "bg-accent hover:opacity-90"
                }`}
                onClick={() => answer(true)}
              >
                {pending.confirmLabel ?? t.ui.common.ok}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
