import type { ReactNode } from "react";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,12,18,0.45)] p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[calc(100vh-4rem)] w-full max-w-[460px] overflow-y-auto rounded-card border border-line bg-surface p-6 shadow-card">
        <h2 className="mb-4 text-[1.15rem] font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
