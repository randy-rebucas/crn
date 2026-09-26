import axios, { type InternalAxiosRequestConfig } from 'axios';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Access tokens are short-lived (15 min by default). The auth provider
// registers how to trade the stored refresh token for a new one; a request
// that comes back 401 is retried once with the fresh token. Resolving to
// null means the session is gone and the provider has already signed out.
type RefreshHandler = () => Promise<string | null>;
let refreshHandler: RefreshHandler | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function setRefreshHandler(handler: RefreshHandler | null) {
  refreshHandler = handler;
}

apiClient.interceptors.response.use(undefined, async (error) => {
  const config = error?.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
  const isAuthCall = typeof config?.url === 'string' && config.url.includes('/v1/auth/');
  if (error?.response?.status !== 401 || !config || config._retried || isAuthCall || !refreshHandler) {
    throw error;
  }

  // Every request that fails while one refresh is running waits on that same
  // refresh: refresh tokens rotate on use, so a second refresh would fail.
  refreshInFlight ??= refreshHandler().finally(() => {
    refreshInFlight = null;
  });
  const token = await refreshInFlight;
  if (!token) throw error;

  config._retried = true;
  config.headers.Authorization = `Bearer ${token}`;
  return apiClient(config);
});
