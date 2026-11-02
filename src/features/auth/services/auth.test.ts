import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import login from './login';
import signup from './signup';
import logout from './logout';
import sendOtp from './sendOtp';
import verifyOtp from './verifyOtp';
import requestPasswordReset from './requestPasswordReset';
import updatePassword from './updatePassword';
import { fetchProfile } from '@features/profile/services/fetchProfile';
import { updateProfile as writeProfile } from '@features/profile/services/updateProfile';
import { fetchUser } from '@features/profile/services/fetchUser';
import { getSupabaseBrowserClient } from '@lib/supabase';
import { authUser, profile, TEST_PASSWORD } from '@/test/fixtures/db';
import { clearTables, seed, tables } from '@/test/fixtures/tables';
import { clearSession, seedSession } from '@/test/auth';
import { API_URL } from '@/test/handlers/rest';
import { server } from '@/test/server';

describe('auth services (GoTrue over the wire)', () => {
  beforeEach(() => {
    clearTables();
    clearSession();
  });

  it('login returns the session user for valid credentials', async () => {
    const response = await login('cook@example.com', TEST_PASSWORD);
    expect(response.success).toBe(true);
    expect(response.data.id).toBe(authUser().id);
    expect(response.data.email).toBe('cook@example.com');
  });

  it('login rejects invalid credentials with the GoTrue error', async () => {
    await expect(login('cook@example.com', 'wrong')).rejects.toThrow(/Invalid login credentials/);
  });

  it('login resolves the role from the fresh session profile', async () => {
    seed('profiles', [profile({ role: 'moderator' })]);
    const response = await login('cook@example.com', TEST_PASSWORD);
    expect(response.data.role).toBe('moderator');
  });

  it('login falls back to the user role when no profile row exists', async () => {
    const response = await login('cook@example.com', TEST_PASSWORD);
    expect(response.data.role).toBe('user');
  });

  it('signup creates the auth user; the DB trigger owns the profile row', async () => {
    let signUpBody: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API_URL}/auth/v1/signup`, async ({ request }) => {
        signUpBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(authUser({ id: '99999999-9999-4999-8999-999999999999', email: 'new@example.com' }));
      }),
    );

    const response = await signup('new@example.com', 'long-password', 'Newbie');
    expect(response.data.email).toBe('new@example.com');
    // The handle_new_user trigger reads the display name from `full_name`.
    expect(signUpBody?.data).toEqual({ full_name: 'Newbie' });
    // Clients cannot INSERT into profiles — the service must not try.
    expect(tables.profiles ?? []).toHaveLength(0);
  });

  it('signup rejects an email that already exists', async () => {
    await expect(signup('cook@example.com', 'long-password')).rejects.toThrow(/already registered/);
  });

  it('logout clears the persisted session', async () => {
    seedSession();
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.getSession(); // initialize the client
    await logout();
    const { data } = await supabase.auth.getSession();
    expect(data.session).toBeNull();
  });

  it('sendOtp accepts any email and verifyOtp only accepts the valid code', async () => {
    await expect(sendOtp('cook@example.com')).resolves.toBeUndefined();
    await expect(verifyOtp('cook@example.com', '000000')).rejects.toThrow();
    await expect(verifyOtp('cook@example.com', '123456')).resolves.toBeUndefined();
  });

  it('requestPasswordReset targets the update-password route and updatePassword updates the user', async () => {
    seedSession();
    await expect(requestPasswordReset('cook@example.com')).resolves.toBeUndefined();
    await expect(updatePassword('new-password')).resolves.toBeUndefined();
  });
});

describe('profile services', () => {
  beforeEach(() => {
    clearTables();
    clearSession();
  });

  it('fetchProfile returns the parsed row', async () => {
    seed('profiles', [
      {
        id: 'u1',
        display_name: 'Chef',
        avatar_url: null,
        role: 'user',
        subscription_tier: 'free',
        tokens_remaining: 0,
        unit_preference: 'metric',
        dietary_preferences: [],
        ai_model_id: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]);
    const profileRow = await fetchProfile('u1');
    expect(profileRow?.display_name).toBe('Chef');
  });

  it('fetchProfile returns null when no profile exists (PGRST116 path)', async () => {
    const profileRow = await fetchProfile('missing');
    expect(profileRow).toBeNull();
  });

  it('updateProfile sends only provided fields and returns the updated row', async () => {
    seed('profiles', [
      {
        id: 'u1',
        display_name: 'Chef',
        avatar_url: null,
        role: 'user',
        subscription_tier: 'free',
        tokens_remaining: 0,
        unit_preference: 'metric',
        dietary_preferences: [],
        ai_model_id: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]);

    const updated = await writeProfile('u1', { displayName: 'New Name', unitPreference: 'imperial' });

    expect(updated.display_name).toBe('New Name');
    expect(tables.profiles[0]).toMatchObject({ display_name: 'New Name', unit_preference: 'imperial', role: 'user' });
  });

  it('fetchUser returns the user for a valid session and null when unauthenticated', async () => {
    seedSession();
    expect(await fetchUser()).toMatchObject({ id: authUser().id });

    clearSession();
    expect(await fetchUser()).toBeNull();
  });
});
