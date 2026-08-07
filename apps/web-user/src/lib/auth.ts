/**
 * Frontend auth utilities — token storage, API interceptor, hooks.
 */
import type { AuthTokens, UserProfile, UserRole } from "@watany/types";

const ACCESS_KEY = "watany_access_token";
const REMEMBER_KEY = "watany_remember";
const CSRF_COOKIE_KEY = "watany_csrf";
const ANON_VOTER_KEY = "watany_anon_voter_id";
const AUTH_STATE_CHANGE_EVENT = "watany:auth-state-change";
let accessTokenMemory: string | null = null;

function emitAuthStateChange(): void {
  if (typeof globalThis.dispatchEvent !== "function") {
    return;
  }

  const event = typeof CustomEvent === "function"
    ? new CustomEvent(AUTH_STATE_CHANGE_EVENT)
    : new Event(AUTH_STATE_CHANGE_EVENT);
  globalThis.dispatchEvent(event);
}

/* ── Token storage ────────────────────────────────────────── */

function getStorage(): Storage {
  // Check if remember me was set - use localStorage, else sessionStorage
  const remember = localStorage.getItem(REMEMBER_KEY) === "true";
  return remember ? localStorage : sessionStorage;
}

export function getAccessToken(): string | null {
  return accessTokenMemory || sessionStorage.getItem(ACCESS_KEY);
}

export function storeTokens(tokens: AuthTokens, rememberMe = true): void {
  accessTokenMemory = tokens.accessToken;

  // Clear from both storages first
  localStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(ACCESS_KEY);

  // Keep the access token ephemeral; refresh now lives in an httpOnly cookie.
  sessionStorage.setItem(ACCESS_KEY, tokens.accessToken);
  localStorage.setItem(REMEMBER_KEY, String(rememberMe));
  // debug: emit state change for tests
  // eslint-disable-next-line no-console
  console.debug('[auth] storeTokens set', { rememberMe, hasToken: Boolean(tokens?.accessToken) });
  emitAuthStateChange();
}

export function clearTokens(): void {
  accessTokenMemory = null;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  sessionStorage.removeItem(ACCESS_KEY);
  // debug: emitted when tokens cleared
  // eslint-disable-next-line no-console
  try {
    // eslint-disable-next-line no-console
    console.debug('[auth] clearTokens', {
      accessTokenMemoryBefore: accessTokenMemory,
      sessionToken: typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(ACCESS_KEY) : null,
      localRemember: typeof localStorage !== 'undefined' ? localStorage.getItem(REMEMBER_KEY) : null,
    });
  } catch (e) {
    // ignore
    // eslint-disable-next-line no-console
    console.debug('[auth] clearTokens (failed to read storage)');
  }
  emitAuthStateChange();
}

export function subscribeAuthStateChange(listener: () => void): () => void {
  if (typeof globalThis.addEventListener !== "function") {
    return () => undefined;
  }

  const handleChange = () => listener();
  globalThis.addEventListener(AUTH_STATE_CHANGE_EVENT, handleChange);
  return () => {
    globalThis.removeEventListener(AUTH_STATE_CHANGE_EVENT, handleChange);
  };
}

export function isLoggedIn(): boolean {
  return !!getAccessToken();
}

/* ── Decode JWT payload (no verification — that's server-side) ─ */

export function decodeToken(token: string): { sub: string; role: UserRole; email: string; exp: number } | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return null;
    }

    // JWT payload is base64url-encoded, so normalize before decoding.
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const decoded = decodeToken(token);
  if (!decoded) return true;
  return decoded.exp * 1000 < Date.now();
}

/* ── Auth header helper ───────────────────────────────────── */

export function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie ? document.cookie.split("; ") : [];
  for (const cookie of cookies) {
    if (cookie.startsWith(`${CSRF_COOKIE_KEY}=`)) {
      return decodeURIComponent(cookie.slice(CSRF_COOKIE_KEY.length + 1));
    }
  }

  return null;
}

export function getAnonymousVoterId(): string {
  if (typeof window === "undefined") {
    return `anon-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  }

  try {
    const existing = window.localStorage.getItem(ANON_VOTER_KEY);
    if (existing && existing.trim().length > 0) {
      return existing.trim();
    }

    const next = `anon-${window.crypto?.randomUUID?.() ?? `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`}`;
    window.localStorage.setItem(ANON_VOTER_KEY, next);
    return next;
  } catch {
    return `anon-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  }
}

/* ── Profile from token ───────────────────────────────────── */

export function profileFromToken(): UserProfile | null {
  const token = getAccessToken();
  if (!token) return null;
  const decoded = decodeToken(token);
  if (!decoded || isTokenExpired(token)) return null;
  return {
    isAuthed: true,
    id: decoded.sub,
    role: decoded.role,
    email: decoded.email,
  };
}
