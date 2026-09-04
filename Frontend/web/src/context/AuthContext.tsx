import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import * as authApi from "../api/auth";
import { getToken, clearToken } from "../api/client";
import { decodeJwtId } from "../utils/jwt";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSelf: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    const id = decodeJwtId(token);
    if (!id) {
      clearToken();
      setLoading(false);
      return;
    }
    authApi
      .listUsers()
      .then((all) => {
        const self = all.find((u) => u._id === id);
        if (self) setUser(self);
        else clearToken();
      })
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setUser(await authApi.login(email, password));
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    setUser(await authApi.register(username, email, password));
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
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
      logout,
      refreshSelf,
    }),
    [user, loading, login, register, logout, refreshSelf],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
