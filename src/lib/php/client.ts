import { formatApiError, parseApiErrorBody } from './api-errors';

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'nb_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function api<T = unknown>(path: string, method: Method = 'GET', body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      const { code, vars } = parseApiErrorBody(body);
      msg = formatApiError(code, vars);
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type AppRole = 'admin' | 'user';

export interface AuthUser {
  id: string;
  email: string | null;
  handle: string;
  display_name: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  roles?: AppRole[];
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}

let inflightMe: Promise<AuthUser | null> | null = null;

export const auth = {
  async signup(email: string, password: string, displayName?: string): Promise<AuthResult> {
    const r = await api<AuthResult>('/api/auth.php?action=signup', 'POST', {
      email,
      password,
      display_name: displayName,
    });
    setToken(r.token);
    return r;
  },

  async login(email: string, password: string): Promise<AuthResult> {
    const r = await api<AuthResult>('/api/auth.php?action=login', 'POST', { email, password });
    setToken(r.token);
    return r;
  },

  async google(credential: string): Promise<AuthResult> {
    const r = await api<AuthResult>('/api/auth.php?action=google', 'POST', { credential });
    setToken(r.token);
    return r;
  },

  async me(): Promise<AuthUser | null> {
    if (!getToken()) return null;
    if (inflightMe) return inflightMe;
    inflightMe = (async () => {
      try {
        return await api<AuthUser>('/api/auth.php?action=me');
      } catch {
        clearToken();
        return null;
      } finally {
        inflightMe = null;
      }
    })();
    return inflightMe;
  },

  async forgotPassword(email: string): Promise<void> {
    await api('/api/auth.php?action=forgot', 'POST', { email });
  },

  async resetPassword(token: string, password: string): Promise<AuthResult> {
    const r = await api<AuthResult>('/api/auth.php?action=reset', 'POST', { token, password });
    setToken(r.token);
    return r;
  },

  async updateProfile(patch: Partial<Pick<AuthUser, 'display_name' | 'bio' | 'avatar_url' | 'handle'>>): Promise<AuthUser> {
    return api<AuthUser>('/api/auth.php?action=profile', 'PATCH', patch);
  },

  logout(): void {
    clearToken();
  },
};

export { api };
