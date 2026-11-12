// The red box a form or panel shows its error in. Draws nothing without a
// message, so callers can pass their error state straight in.
export function ErrorBanner({ message, className = "mb-4" }: { message: string | null | undefined; className?: string }) {
  if (!message) return null;
  return <div className={`${className} rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger`}>{message}</div>;
}
