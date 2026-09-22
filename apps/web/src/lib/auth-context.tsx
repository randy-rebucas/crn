'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient, setAccessToken } from './api-client';

interface EffectivePermission {
  key: string;
  scope: string;
}

interface AuthUser {
  id: string;
  organizationId: string;
  email: string;
  branchIds: string[];
  roles: string[];
  permissions: EffectivePermission[];
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  hasPermission: (key: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const REFRESH_TOKEN_KEY = 'obias.refreshToken';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  // Only start "loading" if there's actually a session to restore — this
  // way the no-token branch below needs no setState at all, so the effect
  // never calls setState synchronously within its own call stack (the
  // react-hooks/set-state-in-effect rule flags that pattern even though the
  // function is async, because nothing awaits before that branch returns).
  const [isLoading, setIsLoading] = useState(
    () => typeof window !== 'undefined' && !!localStorage.getItem(REFRESH_TOKEN_KEY),
  );

  const restoreSession = useCallback(async () => {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem(REFRESH_TOKEN_KEY) : null;

    if (!refreshToken) {
      return;
    }

    try {
      const { data } = await apiClient.post('/v1/auth/refresh', { refreshToken });
      setAccessToken(data.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
      const { data: me } = await apiClient.get('/v1/users/me');
      setUser(me);
    } catch {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      setAccessToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await apiClient.post('/v1/auth/login', { email, password });
    setAccessToken(data.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    setUser(data.user);
    return data.user as AuthUser;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      await apiClient.post('/v1/auth/logout', { refreshToken }).catch(() => undefined);
    }
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setAccessToken(null);
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (key: string) => Boolean(user?.permissions.some((p) => p.key === key)),
    [user],
  );

  const value = useMemo(
    () => ({ user, isLoading, login, logout, hasPermission }),
    [user, isLoading, login, logout, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Each role lands in the route group whose layout fits how that role
// actually works day-to-day: students get the mobile bottom-tab shell,
// instructors get the class/grading-focused shell, everyone else gets the
// admin sidebar. A user can hold multiple roles, so this is a priority
// order, not an exclusive switch.
export function landingRouteForUser(user: Pick<AuthUser, 'roles'>): string {
  if (user.roles.includes('Student')) return '/student';
  if (user.roles.includes('Instructor')) return '/instructor';
  return '/dashboard';
}
