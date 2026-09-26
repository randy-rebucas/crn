'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient, setAccessToken, setRefreshHandler } from './api-client';

interface EffectivePermission {
  key: string;
  scope: string;
}

interface AuthUser {
  id: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  branchIds: string[];
  roles: string[];
  permissions: EffectivePermission[];
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<AuthUser>;
  logout: () => Promise<void>;
  hasPermission: (key: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const REFRESH_TOKEN_KEY = 'obias.refreshToken';

// "Remember me" decides which storage survives closing the browser tab:
// localStorage persists across sessions, sessionStorage clears when the
// tab closes. Whichever one holds the token, only one holds it at a time.
// Exported so a password change can tell the API which session to keep.
export function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY) ?? sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

function storeRefreshToken(token: string, rememberMe: boolean) {
  if (typeof window === 'undefined') return;
  if (rememberMe) {
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
  }
}

function clearStoredRefreshToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

// Refresh tokens rotate on use, so two concurrent restores (React's dev
// double-invoked effect, or two quick remounts) would send the same token
// twice: the second is rejected and, left alone, its failure would wipe the
// access token the first one just set. Every concurrent caller shares one
// in-flight refresh instead.
let restoreInFlight: Promise<AuthUser> | null = null;

function refreshSessionOnce(refreshToken: string, rememberMe: boolean): Promise<AuthUser> {
  restoreInFlight ??= (async () => {
    const { data } = await apiClient.post('/v1/auth/refresh', { refreshToken });
    setAccessToken(data.accessToken);
    storeRefreshToken(data.refreshToken, rememberMe);
    const { data: me } = await apiClient.get<AuthUser>('/v1/users/me');
    return me;
  })().finally(() => {
    restoreInFlight = null;
  });
  return restoreInFlight;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  // Only start "loading" if there's actually a session to restore — this
  // way the no-token branch below needs no setState at all, so the effect
  // never calls setState synchronously within its own call stack (the
  // react-hooks/set-state-in-effect rule flags that pattern even though the
  // function is async, because nothing awaits before that branch returns).
  const [isLoading, setIsLoading] = useState(() => !!getStoredRefreshToken());

  const restoreSession = useCallback(async () => {
    const refreshToken = getStoredRefreshToken();
    // A restored session keeps whichever storage it was found in — if it
    // came from sessionStorage (remember me was off), the refreshed token
    // stays in sessionStorage rather than being promoted to localStorage.
    const rememberMe = typeof window !== 'undefined' && !!localStorage.getItem(REFRESH_TOKEN_KEY);

    if (!refreshToken) {
      return;
    }

    try {
      const me = await refreshSessionOnce(refreshToken, rememberMe);
      setUser(me);
    } catch {
      // Only tear the session down if the token that failed is still the one
      // on file — if something else already rotated it, that session is live.
      if (getStoredRefreshToken() === refreshToken) {
        clearStoredRefreshToken();
        setAccessToken(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Lets api-client recover from an expired access token mid-session: trade
  // the stored refresh token for a new pair and retry the failed request. If
  // the refresh token is gone or rejected, the session ends here and the
  // route layouts send the user back to /login.
  useEffect(() => {
    setRefreshHandler(async () => {
      const refreshToken = getStoredRefreshToken();
      if (!refreshToken) {
        setAccessToken(null);
        setUser(null);
        queryClient.clear();
        return null;
      }
      const rememberMe = !!localStorage.getItem(REFRESH_TOKEN_KEY);
      try {
        const { data } = await apiClient.post('/v1/auth/refresh', { refreshToken });
        setAccessToken(data.accessToken);
        storeRefreshToken(data.refreshToken, rememberMe);
        return data.accessToken as string;
      } catch {
        // Same rule as restoreSession: only tear down if nothing else has
        // already rotated the token in the meantime.
        if (getStoredRefreshToken() === refreshToken) {
          clearStoredRefreshToken();
          setAccessToken(null);
          setUser(null);
          queryClient.clear();
        }
        return null;
      }
    });
    return () => setRefreshHandler(null);
  }, [queryClient]);

  const login = useCallback(async (email: string, password: string, rememberMe = true) => {
    const { data } = await apiClient.post('/v1/auth/login', { email, password });
    setAccessToken(data.accessToken);
    storeRefreshToken(data.refreshToken, rememberMe);
    setUser(data.user);
    return data.user as AuthUser;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getStoredRefreshToken();
    if (refreshToken) {
      await apiClient.post('/v1/auth/logout', { refreshToken }).catch(() => undefined);
    }
    clearStoredRefreshToken();
    setAccessToken(null);
    setUser(null);
    // Query keys aren't per-user ('my-attempts', 'notifications', ...), and
    // the client outlives the session, so the next person to sign in on this
    // tab would otherwise see this account's cached data until refetches land.
    queryClient.clear();
  }, [queryClient]);

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
  // `roles` holds role keys (e.g. 'lead_instructor'), not display names.
  if (user.roles.includes('student')) return '/student';
  if (user.roles.some((r) => r === 'instructor' || r === 'lead_instructor')) return '/instructor';
  return '/dashboard';
}
