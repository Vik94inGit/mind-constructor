import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

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
        className="text-[1.05rem] font-bold tracking-[-0.01em] text-ink"
      >
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
