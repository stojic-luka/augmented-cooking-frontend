import { authSession, authUser, IDS } from './fixtures/db';
import { TEST_ORIGIN } from './origin';

/**
 * Session control without touching the Supabase client's internals: the
 * browser client persists sessions in localStorage, so tests seed or clear
 * the storage key directly. Every supabase-js read (`getSession`,
 * `getUser`, the axios interceptor) goes through storage, making this
 * deterministic with no network traffic.
 */

const STORAGE_KEY = `sb-${new URL(TEST_ORIGIN).hostname.split('.')[0]}-auth-token`;

/** Seeds a valid, non-expiring session for the fixture user. */
export function seedSession(overrides: Record<string, unknown> = {}): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(authSession(overrides)));
}

/** Seeds an expired session — getSession() will attempt a refresh. */
export function seedExpiredSession(): void {
  seedSession({ expires_at: 1_000_000_000 });
}

export function clearSession(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export { authUser, IDS };
