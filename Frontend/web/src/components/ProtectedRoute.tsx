import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getDemoMapId } from "../api/client";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="p-12 text-center text-ink-soft">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  // A demo session (see api/auth.ts's tryDemo) only ever has the one map it
  // was seeded with — no dashboard, no "Maps" home, nothing else to browse
  // to. Redirected straight back to it from anywhere else this route group
  // covers ("/" included), rather than just hiding the links that would
  // otherwise get here (a typed-in URL, browser back/forward, or a stale
  // bookmark all reach the same route regardless of what's hidden in the
  // UI). Falls through to the ordinary dashboard/map route if the demo map
  // id somehow isn't in hand — never actively locks a real, non-demo user
  // out of anything.
  const demoMapId = user.isDemo ? getDemoMapId() : null;
  if (demoMapId && location.pathname !== `/maps/${demoMapId}`) {
    return <Navigate to={`/maps/${demoMapId}`} replace />;
  }
  return <Outlet />;
}

export function AdminRoute() {
  const { isAdmin, loading, user } = useAuth();
  if (loading) return <div className="p-12 text-center text-ink-soft">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}
