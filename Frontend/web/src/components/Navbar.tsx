import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// A plain target/bullseye — same concentric-rings-plus-center-dot shape
// OutcomeBadge's own GoalSymbol draws for a Solution node (the app's own
// "this is what we're aiming for" motif), standing in here as the app's
// logo mark instead of that map-specific component's own bigger, 400x300-
// viewBox SVG. currentColor so it always matches the link text's own
// color (including its hover state) with no separate color prop to keep
// in sync.
function TargetLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  if (!user) return null;

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-2 py-[0.3rem] text-[0.9rem] font-medium ${
      isActive
        ? "bg-surface-2 text-ink"
        : "text-ink-soft hover:bg-surface-2 hover:text-ink"
    }`;

  return (
    <header className="flex items-center gap-6 border-b border-line bg-surface px-6 py-[0.85rem]">
      <NavLink
        to="/"
        className="flex items-center gap-[0.45rem] text-[1.05rem] font-bold tracking-[-0.01em] text-ink"
      >
        <TargetLogo />
        Mind Constructor
      </NavLink>
      <nav className="flex flex-1 gap-4">
        <NavLink to="/" end className={navLinkClass}>
          Maps
        </NavLink>
        {isAdmin && (
          <NavLink to="/admin" className={navLinkClass}>
            Admin
          </NavLink>
        )}
      </nav>
      <div className="flex items-center gap-[0.7rem]">
        <span className="text-[0.85rem] text-ink-soft">{user.username}</span>
        <button
          className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-transparent bg-transparent px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-120ms enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => logout()}
        >
          Log out
        </button>
      </div>
    </header>
  );
}
