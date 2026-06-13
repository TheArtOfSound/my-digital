import type { PublicUser } from "@my-digital/types";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";

interface AuthContextValue {
  user: PublicUser | null;
  status: "loading" | "ready";
  /** True once the signed-in account owns a seller profile. */
  isSeller: boolean;
  signup: (input: { email: string; password: string; displayName: string }) => Promise<PublicUser>;
  login: (input: { email: string; password: string }) => Promise<PublicUser>;
  logout: () => Promise<void>;
  /** Re-fetch the current account (e.g. after becoming a seller). */
  refresh: () => Promise<PublicUser | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  const refresh = useCallback(async () => {
    try {
      const { user: me } = await api.authMe();
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
    } finally {
      setStatus("ready");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signup = useCallback(
    async (input: { email: string; password: string; displayName: string }) => {
      const { user: created } = await api.authSignup(input);
      setUser(created);
      return created;
    },
    []
  );

  const login = useCallback(async (input: { email: string; password: string }) => {
    const { user: loggedIn } = await api.authLogin(input);
    setUser(loggedIn);
    return loggedIn;
  }, []);

  const logout = useCallback(async () => {
    await api.authLogout();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isSeller: Boolean(user?.creatorId),
      signup,
      login,
      logout,
      refresh
    }),
    [user, status, signup, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
