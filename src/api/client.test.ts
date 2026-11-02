import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { api } from './client';
import { clearSession, seedSession } from '@/test/auth';
import { API_URL } from '@/test/handlers/rest';
import { server } from '@/test/server';

/**
 * Contract of the shared axios client itself: auth-token attachment,
 * the unauthenticated request block, and 401 recovery via session refresh.
 * All requests run through MSW so the real interceptors execute.
 */
describe('api client', () => {
  afterEach(() => {
    clearSession();
  });

  it('rejects before any network traffic when no session exists', async () => {
    clearSession();
    let reachedServer = false;
    server.use(
      http.get(`${API_URL}/ai/models`, () => {
        reachedServer = true;
        return HttpResponse.json({ models: [] });
      }),
    );

    await expect(api.get('/ai/models')).rejects.toThrow('Request blocked: User is not authenticated.');
    expect(reachedServer).toBe(false);
  });

  it('attaches the persisted session token as a Bearer header', async () => {
    seedSession();
    let authorization = '';
    server.use(
      http.get(`${API_URL}/ai/models`, ({ request }) => {
        authorization = request.headers.get('authorization') ?? '';
        return HttpResponse.json({ models: [] });
      }),
    );

    await api.get('/ai/models');
    expect(authorization).toBe('Bearer test-access-token');
  });

  it('refreshes the session and retries once when the API answers 401', async () => {
    seedSession();
    const tokensSeen: string[] = [];

    server.use(
      http.get(`${API_URL}/ai/models`, ({ request }) => {
        const token = request.headers.get('authorization') ?? '';
        tokensSeen.push(token);
        if (token === 'Bearer test-access-token') {
          return HttpResponse.json({ message: 'Token revoked' }, { status: 401 });
        }
        return HttpResponse.json({ models: [] });
      }),
    );

    const response = await api.get('/ai/models');
    expect(response.status).toBe(200);
    expect(tokensSeen).toEqual(['Bearer test-access-token', 'Bearer refreshed-access-token']);

    // The refreshed session is persisted for subsequent requests.
    const supabase = (await import('@lib/supabase')).getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    expect(data.session?.access_token).toBe('refreshed-access-token');
  });

  it('surfaces the original error when session refresh fails', async () => {
    seedSession();
    let requests = 0;
    server.use(
      http.get(`${API_URL}/ai/models`, () => {
        requests += 1;
        return HttpResponse.json({ message: 'Token revoked' }, { status: 401 });
      }),
      http.post(`${API_URL}/auth/v1/token`, () =>
        HttpResponse.json({ code: 400, error_code: 'invalid_grant', msg: 'Refresh token not found' }, { status: 400 }),
      ),
    );

    await expect(api.get('/ai/models')).rejects.toThrow();
    // One original attempt, no retry after failed recovery.
    expect(requests).toBe(1);
  });

  it('surfaces the backend `{ message }` body as the rejected error message', async () => {
    seedSession();
    server.use(
      http.post(`${API_URL}/billing/tokens`, () => HttpResponse.json({ message: 'Quota exceeded' }, { status: 402 })),
    );

    const error = (await api.post('/billing/tokens', { tokens: 10000 }).catch((err: unknown) => err)) as Error & {
      cause?: { response?: { status?: number } };
    };
    expect(error.message).toBe('Quota exceeded');
    // The original AxiosError stays reachable for callers that need status.
    expect(error.cause?.response?.status).toBe(402);
  });

  it('keeps the raw error for responses without a `{ message }` body', async () => {
    seedSession();
    server.use(http.post(`${API_URL}/billing/tokens`, () => HttpResponse.error()));

    const error = (await api.post('/billing/tokens', { tokens: 1 }).catch((err: unknown) => err)) as Error;
    expect(error.message).not.toContain('undefined');
    expect(error.message).toContain('Network Error');
  });
});
