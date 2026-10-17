import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from '../lib/http';
import { clearSession, profileStore, tokenStore } from '../lib/tokenStore';
import type { User } from '../types';
import { AuthContext, type AuthContextValue } from './context';

interface AuthResponse {
  data: { user: User; token: string };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Bootstrap. A stored token means "already signed in": the cached profile is
  // restored right away so the app opens on the tabs, and `/me` only refreshes
  // the profile in the background. The session ends for exactly two reasons —
  // the user logs out, or the server rejects the token (401/403). A backend that
  // is unreachable, slow, or erroring must never sign anybody out.
  useEffect(() => {
    let active = true;

    (async () => {
      const [token, cachedProfile] = await Promise.all([tokenStore.get(), profileStore.get()]);
      if (!active) return;

      if (!token) {
        setIsLoading(false);
        return;
      }

      setHasSession(true);
      if (cachedProfile) setUser(cachedProfile);
      setIsLoading(false);

      try {
        const res = await api.get<{ data: User }>('/me');
        if (!active) return;
        setUser(res.data);
        await profileStore.set(res.data);
      } catch (error) {
        const rejected =
          error instanceof ApiError && (error.status === 401 || error.status === 403);
        if (!active || !rejected) return;

        setHasSession(false);
        setUser(null);
        await clearSession();
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const startSession = useCallback(async ({ user: nextUser, token }: AuthResponse['data']) => {
    await tokenStore.set(token);
    await profileStore.set(nextUser);
    setUser(nextUser);
    setHasSession(true);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<AuthResponse>('/auth/login', { email, password });
      await startSession(res.data);
    },
    [startSession],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const res = await api.post<AuthResponse>('/auth/register', { name, email, password });
      await startSession(res.data);
    },
    [startSession],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Best-effort: the local session is dropped even when the server is away.
    }
    await clearSession();
    setUser(null);
    setHasSession(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: hasSession,
      login,
      register,
      logout,
    }),
    [user, isLoading, hasSession, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
