// The error banner's dismiss button.
const btnSmGhost =
  "inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-transparent bg-transparent px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50";

const TONE_CLASS = {
  success: "bg-success-bg text-success",
  danger: "bg-danger-bg text-danger",
} as const;

// A dismissible line over the still-live canvas — a passing notice (success)
// or a failed action (danger). Never the full-page failure view.
export function MapBanner({
  tone,
  message,
  onDismiss,
}: {
  tone: keyof typeof TONE_CLASS;
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      className={`mx-4 mt-[0.6rem] flex items-center justify-between gap-3 rounded-lg ${TONE_CLASS[tone]} px-[0.9rem] py-[0.7rem] text-[0.85rem]`}
    >
      {message}
      <button className={btnSmGhost} onClick={onDismiss}>
        ✕
      </button>
    </div>
  );
}
