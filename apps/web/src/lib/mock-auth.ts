import type { AxiosAdapter, AxiosResponse } from 'axios';
import { apiClient } from './api-client';
import { DEMO_USERS, findDemoUser, findDemoUserById } from './demo-users';

// Stand-in for a backend session store: maps refresh tokens issued during
// this browser session back to the demo user they belong to. There is no
// NestJS API running yet, so this lets the real login/refresh/logout flow
// in auth-context.tsx be exercised end-to-end against seeded demo accounts.
const sessionsByRefreshToken = new Map<string, string>();

function issueTokens(userId: string) {
  const suffix = `${userId}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  const accessToken = `demo-access.${suffix}`;
  const refreshToken = `demo-refresh.${suffix}`;
  sessionsByRefreshToken.set(refreshToken, userId);
  return { accessToken, refreshToken };
}

function toAuthUser(userId: string) {
  const user = findDemoUserById(userId);
  if (!user) return null;
  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    branchIds: user.branchIds,
    roles: user.roles,
    permissions: user.permissions,
  };
}

function respond<T>(data: T, status = 200): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {},
    config: {} as never,
  };
}

function fail(status: number, message: string): never {
  const error = new Error(message) as Error & { response: AxiosResponse; isAxiosError: true };
  error.response = respond({ message }, status);
  error.isAxiosError = true;
  throw error;
}

export function installMockAuthAdapter() {
  const realAdapter = apiClient.defaults.adapter as AxiosAdapter;

  const mockAdapter: AxiosAdapter = async (config) => {
    const method = (config.method ?? 'get').toLowerCase();
    const url = config.url ?? '';
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data ?? {});

    if (method === 'post' && url.endsWith('/v1/auth/login')) {
      const user = findDemoUser(body.email ?? '', body.password ?? '');
      if (!user) fail(401, 'Invalid email or password.');
      const tokens = issueTokens(user.id);
      return respond({ ...tokens, user: toAuthUser(user.id) });
    }

    if (method === 'post' && url.endsWith('/v1/auth/refresh')) {
      const userId = sessionsByRefreshToken.get(body.refreshToken ?? '');
      if (!userId) fail(401, 'Session expired.');
      sessionsByRefreshToken.delete(body.refreshToken);
      const tokens = issueTokens(userId);
      return respond(tokens);
    }

    if (method === 'post' && url.endsWith('/v1/auth/logout')) {
      sessionsByRefreshToken.delete(body.refreshToken ?? '');
      return respond({ success: true });
    }

    if (method === 'get' && url.endsWith('/v1/users/me')) {
      const bearer = (config.headers?.Authorization as string | undefined) ?? '';
      const token = bearer.replace(/^Bearer\s+/, '');
      const userId = token.split('.')[1];
      const authUser = userId ? toAuthUser(userId) : null;
      if (!authUser) fail(401, 'Not authenticated.');
      return respond(authUser);
    }

    // Everything else falls through to the real backend (not implemented yet).
    return realAdapter(config);
  };

  apiClient.defaults.adapter = mockAdapter;
}

export { DEMO_USERS };
