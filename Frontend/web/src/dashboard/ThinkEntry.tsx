import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { loadDraft } from "../utils/thoughtFlow";
import { useI18n } from "../i18n/I18nContext";

// The way in to the "Think it through" flow (pages/ThinkPage.tsx): a single
// open question and a box to answer it in, so the first thing on the
// dashboard is an invitation to write rather than a form to fill in. Whatever
// is typed here becomes the central thought on the flow's first step.
export function ThinkEntry() {
  const { user } = useAuth();
  const { t } = useI18n();
  const tt = t.ui.think.entry;
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [draft] = useState(() => (user ? loadDraft(user._id) : null));
  const draftCount = draft?.thoughts.filter((x) => x.text.trim()).length ?? 0;
  const hasDraft = !!draft && (draft.center.trim() !== "" || draftCount > 0);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    // A new thought would replace the draft in progress — ask first, and
    // resume the draft instead if they'd rather keep it.
    if (hasDraft && text.trim() && !confirm(t.ui.think.startOverConfirm)) {
      navigate("/think");
      return;
    }
    navigate("/think", { state: { seed: text } });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mb-8 rounded-card border border-line bg-surface p-5 shadow-card sm:p-6"
      style={{ backgroundImage: "radial-gradient(circle at 100% 0%, var(--accent-soft), transparent 55%)" }}
    >
      <h2 className="m-0 text-[1.3rem] font-bold">{tt.title}</h2>
      <p className="mt-1 mb-4 max-w-[60ch] text-[0.9rem] text-ink-soft">{tt.hint}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="w-full rounded-lg border border-line bg-surface px-3 py-[0.6rem] text-[0.95rem] text-ink outline-none transition-[border-color,box-shadow] duration-[120ms] focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]"
          placeholder={tt.placeholder}
          aria-label={tt.title}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-accent bg-accent px-4 py-[0.55rem] text-[0.88rem] font-semibold text-white transition-opacity duration-[120ms] hover:opacity-90"
        >
          {tt.start} →
        </button>
      </div>
      {hasDraft && (
        <button
          type="button"
          className="mt-3 cursor-pointer border-0 bg-transparent p-0 text-[0.82rem] font-semibold text-accent-ink hover:underline"
          onClick={() => navigate("/think")}
        >
          {tt.resume(draftCount)} →
        </button>
      )}
    </form>
  );
}
