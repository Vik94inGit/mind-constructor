import type { ReactNode } from "react";
import { CardMenu } from "../components/CardMenu";
import type { CardMenuItem } from "../components/CardMenu";

// One entry in the dashboard's file-browser grid: a big icon with its title
// underneath and a "⋮" menu in the corner, instead of a full card.
export function LibraryTile({
  icon,
  title,
  subtitle,
  menu,
  onOpen,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  menu: CardMenuItem[];
  onOpen: () => void;
}) {
  return (
    <div className="group relative flex flex-col items-center rounded-card px-2 pt-3 pb-2 text-center transition-colors duration-[120ms] hover:bg-surface-2">
      <button
        type="button"
        className="flex w-full cursor-pointer flex-col items-center gap-[0.4rem] rounded-lg border-none bg-transparent p-0 text-ink focus-visible:outline-2 focus-visible:outline-accent"
        onClick={onOpen}
        title={title}
      >
        {icon}
        <span className="line-clamp-2 w-full text-[0.85rem] leading-tight font-semibold break-words">{title}</span>
        {subtitle && <span className="text-[0.7rem] text-ink-soft">{subtitle}</span>}
      </button>
      <div className="absolute top-1 right-0">
        <CardMenu items={menu} />
      </div>
    </div>
  );
}

export function FolderIcon({ className = "h-14 w-14", muted = false }: { className?: string; muted?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        d="M4 12a4 4 0 0 1 4-4h11l4 5h17a4 4 0 0 1 4 4v19a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"
        fill={muted ? "var(--surface-2, #e5e7eb)" : "#e8b04a"}
        stroke={muted ? "currentColor" : "#c38a26"}
        strokeOpacity={muted ? 0.35 : 1}
        strokeWidth="1.5"
      />
      <path d="M4 18h40" stroke={muted ? "currentColor" : "#c38a26"} strokeOpacity={muted ? 0.35 : 0.6} strokeWidth="1.5" />
    </svg>
  );
}

// A little three-node map in the board's own color — what a map looks like.
export function MapIcon({ color, shared = false }: { color?: string; shared?: boolean }) {
  const c = color || "var(--accent)";
  return (
    <span className="relative inline-flex">
      <svg viewBox="0 0 48 48" className="h-14 w-14" aria-hidden="true">
        <rect x="3" y="3" width="42" height="42" rx="10" fill={c} fillOpacity="0.16" stroke={c} strokeWidth="1.5" />
        <path d="M24 14 14 33M24 14l10 19M14 33h20" stroke={c} strokeWidth="2" strokeLinecap="round" />
        <circle cx="24" cy="14" r="4.5" fill={c} />
        <circle cx="14" cy="33" r="4.5" fill={c} />
        <circle cx="34" cy="33" r="4.5" fill={c} />
      </svg>
      {shared && (
        // Someone else's map you were invited to.
        <svg viewBox="0 0 20 20" className="absolute -right-1 -bottom-1 h-5 w-5" aria-hidden="true">
          <circle cx="10" cy="10" r="9" fill="var(--surface, #fff)" stroke={c} strokeWidth="1.5" />
          <circle cx="7.5" cy="8" r="2" fill={c} />
          <circle cx="12.5" cy="8" r="2" fill={c} />
          <path d="M4.5 14.5c.6-2 1.7-3 3-3s2.4 1 3 3M9.5 14.5c.6-2 1.7-3 3-3s2.4 1 3 3" stroke={c} strokeWidth="1.3" fill="none" />
        </svg>
      )}
    </span>
  );
}
