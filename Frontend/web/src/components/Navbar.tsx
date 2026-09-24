import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSwitcher } from "./LanguageSwitcher";

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
  const { t } = useI18n();
  if (!user) return null;

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-2 py-[0.3rem] text-[0.9rem] font-medium ${
      isActive
        ? "bg-surface-2 text-ink"
        : "text-ink-soft hover:bg-surface-2 hover:text-ink"
    }`;

  return (
    // gap-3, not gap-6, below sm — every child group here has its own
    // internal spacing already; the wide 6-unit gap between *groups* is a
    // desktop-only nicety, not something a 375px-wide phone has room to
    // spare (a gap-6 row would push username + logout button clean off
    // the right edge, and wrap "Mind Constructor" onto its own second
    // line, pushing the row taller still).
    <header className="flex items-center gap-3 sm:gap-6 border-b border-line bg-surface px-3 sm:px-6 py-[0.85rem]">
      <NavLink
        to="/"
        className="flex items-center gap-[0.45rem] text-[1.05rem] font-bold tracking-[-0.01em] text-ink"
      >
        <TargetLogo />
        {/* The wordmark text is the single biggest thing in this row not
            already load-bearing (the logo mark alone still reads as "home"
            — NavLink's own click target, not just decoration) — dropped
            below sm rather than shrunk, same "cut it, don't just make it
            smaller and hope" reasoning as the username below. */}
        <span className="hidden sm:inline">Mind Constructor</span>
      </NavLink>
      <nav className="flex flex-1 gap-2 sm:gap-4">
        <NavLink to="/" end className={navLinkClass}>
          {t.nav.maps}
        </NavLink>
        {isAdmin && (
          <NavLink to="/admin" className={navLinkClass}>
            {t.nav.admin}
          </NavLink>
        )}
      </nav>
      <div className="flex items-center gap-[0.4rem] sm:gap-[0.7rem]">
        <LanguageSwitcher />
        <ThemeToggle />
        {/* Dropped below sm, not truncated — a demo account's own username
            (demo-<8 random chars>) is exactly the kind of long, not
            particularly meaningful string that reads worse clipped to a
            few characters than just left off a cramped header entirely;
            it's still shown in full elsewhere (Info tab's "by <username>"
            on any node, the members list). */}
        <span className="hidden sm:inline text-[0.85rem] text-ink-soft">{user.username}</span>
        <button
          className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-transparent bg-transparent px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-120ms enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => logout()}
        >
          {t.nav.logout}
        </button>
      </div>
    </header>
  );
}
