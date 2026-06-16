import { useSyncExternalStore } from 'react';
import { socket, SERVER_URL } from './socket';

const TOKEN_KEY = 'php_token';
const USER_KEY = 'php_user';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  totalGames: number;
  wins: number;
}

// ── Tiny external store ─────────────────────────────────────────────────────────

let currentUser: AuthUser | null = loadStoredUser();
const listeners = new Set<() => void>();

function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function emit() {
  for (const l of listeners) l();
}

function setSession(token: string | null, user: AuthUser | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);

  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);

  currentUser = user;
  // Re-handshake so the server picks up (or drops) the identity immediately.
  if (socket.connected) {
    socket.disconnect();
    socket.connect();
  }
  emit();
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function getUser() { return currentUser; }
export function getToken() { return localStorage.getItem(TOKEN_KEY); }

// ── React hook ──────────────────────────────────────────────────────────────────

export function useAuth() {
  return useSyncExternalStore(subscribe, getUser, getUser);
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function postJson(path: string, body: unknown) {
  const res = await fetch(`${SERVER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Bir hata oluştu, tekrar dene.');
  return data as { token: string; user: AuthUser };
}

export async function register(input: { username: string; email: string; password: string }) {
  const { token, user } = await postJson('/auth/register', input);
  setSession(token, user);
  return user;
}

export async function login(input: { identifier: string; password: string }) {
  const { token, user } = await postJson('/auth/login', input);
  setSession(token, user);
  return user;
}

export function logout() {
  setSession(null, null);
}

// Re-fetch the current user (e.g. to pull updated stats after a game).
export async function refreshMe(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${SERVER_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 401) setSession(null, null); // stale/expired token
      return null;
    }
    const data = (await res.json()) as { user: AuthUser };
    currentUser = data.user;
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    emit();
    return data.user;
  } catch {
    return null;
  }
}
