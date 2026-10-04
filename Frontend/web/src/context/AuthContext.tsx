import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import * as authApi from "../api/auth";
import { clearReadCache, setOfflineUser } from "../offline/sync";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  /** "Try it without registering" — see api/auth.ts's tryDemo. Resolves to
   *  the freshly-seeded demo map's own id so the caller can navigate
   *  straight there, the one thing this flow needs that every other login
   *  path here doesn't. */
  tryDemo: () => Promise<string>;
  logout: () => Promise<void>;
  refreshSelf: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Told right away, not in an effect: pages below may already be saving
  // something offline in their own first effects, which run before this
  // provider's. Only this user's own offline changes are ever sent (see
  // offline/sync.ts).
  const setUser = useCallback((next: User | null) => {
    setOfflineUser(next?._id ?? null);
    setUserState(next);
  }, []);

  useEffect(() => {
    // Relies purely on the mc_sid cookie (sent automatically, see
    // api/client.ts's credentials:"include") — nothing left here to decode
    // or store client-side; authApi.me() itself swallows a 401 into null.
    authApi
      .me()
      .then(setUser)
      .finally(() => setLoading(false));
  }, [setUser]);

  const login = useCallback(async (email: string, password: string) => {
    setUser(await authApi.login(email, password));
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    setUser(await authApi.register(username, email, password));
  }, []);

  // One entry point for both "sign in with Google" and "register with
  // Google" — same as the backend's single POST /api/auth/google (see
  // googleAuthAbl's own doc comment), there's no separate flow here either.
  const loginWithGoogle = useCallback(async (idToken: string) => {
    setUser(await authApi.googleLogin(idToken));
  }, []);

  const tryDemo = useCallback(async () => {
    const { user: demoUser, mapId } = await authApi.tryDemo();
    setUser(demoUser);
    return mapId;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    // What this browser kept of their maps isn't for whoever signs in next.
    await clearReadCache();
    setUser(null);
  }, []);

  // Unlike login/register, this needs the *full* record (e.g. isBlocked),
  // which the auth endpoints still don't return — so this one legitimately
  // still goes through the full user listing.
  const refreshSelf = useCallback(async () => {
    if (!user) return;
    const all = await authApi.listUsers();
    const self = all.find((u) => u._id === user._id);
    if (self) setUser(self);
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === "admin",
      login,
      register,
      loginWithGoogle,
      tryDemo,
      logout,
      refreshSelf,
    }),
    [user, loading, login, register, loginWithGoogle, tryDemo, logout, refreshSelf],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
