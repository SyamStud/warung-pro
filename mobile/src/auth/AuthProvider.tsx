import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../lib/http';
import { tokenStore } from '../lib/tokenStore';
import type { User } from '../types';
import { AuthContext, type AuthContextValue } from './context';

interface AuthResponse {
  data: { user: User; token: string };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Bootstrap: if a stored token exists, resolve the current user.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await tokenStore.get();
        if (!token) return;
        const res = await api.get<{ data: User }>('/me');
        if (active) setUser(res.data);
      } catch {
        // Invalid/expired token — discard it and fall back to logged out.
        await tokenStore.clear();
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<AuthResponse>('/auth/login', { email, password });
    await tokenStore.set(res.data.token);
    setUser(res.data.user);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await api.post<AuthResponse>('/auth/register', { name, email, password });
    await tokenStore.set(res.data.token);
    setUser(res.data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      await tokenStore.clear();
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
