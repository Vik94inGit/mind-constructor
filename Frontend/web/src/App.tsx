import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { ProtectedRoute, AdminRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { MapPage } from "./pages/MapPage";
import { AdminPage } from "./pages/AdminPage";

export default function App() {
  const location = useLocation();
  // A map already carries its own toolbar (back link, name, member count,
  // Link/Add/Invite…) — the global Navbar above it is redundant there and,
  // on a small screen, costs a whole row of vertical space the canvas needs
  // more. Hidden only on that one route; every other page keeps it.
  const onMapPage = /^\/maps\/[^/]+$/.test(location.pathname);

  return (
    <div className="flex h-full flex-col">
      {!onMapPage && <Navbar />}
      <main className="flex min-h-0 flex-1 flex-col">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/maps/:mapId" element={<MapPage />} />
          </Route>

          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
