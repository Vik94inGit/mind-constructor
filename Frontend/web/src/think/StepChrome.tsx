import type { ReactNode } from "react";

// The title block and the back/next row every step of the flow shares.
export function StepHeader({ title, hint }: { title: string; hint: string }) {
  return (
    <header className="mb-5">
      <h1 className="m-0 text-[1.6rem] leading-tight font-bold">{title}</h1>
      <p className="mt-2 mb-0 max-w-[60ch] text-[0.95rem] text-ink-soft">{hint}</p>
    </header>
  );
}

export function StepNav({ back, next }: { back?: ReactNode; next: ReactNode }) {
  return (
    <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
      <div>{back}</div>
      <div>{next}</div>
    </div>
  );
}
