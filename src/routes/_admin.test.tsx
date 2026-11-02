import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryClient } from '@lib/query-client';
import { getSupabaseBrowserClient } from '@lib/supabase';
import { routeTree } from '@/routeTree.gen';
import { dbRecipe, profile } from '@/test/fixtures/db';
import { clearTables, seed } from '@/test/fixtures/tables';
import { clearSession, seedSession } from '@/test/auth';

/**
 * The /admin area: index redirect onto the system dashboard, the group's
 * session/role guard, and the "Back to app" entry. Tests run the REAL
 * generated route tree with seeded localStorage sessions; every network call
 * goes through MSW.
 */

/** Same provider/router stack as production, on a memory history. */
function renderAppRoutes(initialPath: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    context: { queryClient },
  });

  return { ...render(<RouterProvider router={router} />), router };
}

describe('/admin routing', () => {
  beforeEach(() => {
    clearSession();
    clearTables();
    queryClient.clear();
  });

  it('redirects an admin from /admin onto the system dashboard', async () => {
    seedSession();
    seed('profiles', [profile({ role: 'admin' })]);

    const { router } = renderAppRoutes('/admin');

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/dashboard'), { timeout: 5000 });
    expect(await screen.findByRole('link', { name: 'Back to app' }, { timeout: 5000 })).toBeInTheDocument();
  });

  it('sends an anonymous visitor to the login wall, preserving the target', async () => {
    const { router } = renderAppRoutes('/admin');

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'), { timeout: 5000 });
    expect(router.state.location.search).toMatchObject({ next: '/admin' });
  });

  it('bounces a regular user back to the app', async () => {
    seedSession();
    seed('profiles', [profile({ role: 'user' })]);
    seed('recipes', [dbRecipe()]);

    const { router } = renderAppRoutes('/admin');

    // The guard redirects to /recipes; its public twin then hands the
    // signed-in user to the protected explorer.
    await waitFor(() => expect(router.state.location.pathname).toBe('/recipes/search'), { timeout: 5000 });
  });

  it('bounces a moderator back to the app', async () => {
    seedSession();
    seed('profiles', [profile({ role: 'moderator' })]);
    seed('recipes', [dbRecipe()]);

    const { router } = renderAppRoutes('/admin/dashboard');

    await waitFor(() => expect(router.state.location.pathname).toBe('/recipes/search'), { timeout: 5000 });
  });

  it('returns to the app via the "Back to app" entry', async () => {
    seedSession();
    seed('profiles', [profile({ role: 'admin' })]);
    const user = userEvent.setup();

    const { router } = renderAppRoutes('/admin');
    await user.click(await screen.findByRole('link', { name: 'Back to app' }, { timeout: 5000 }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/recipes/search'), { timeout: 5000 });
  });

  it('makes no redirect decision while the session is still restoring', async () => {
    const supabase = getSupabaseBrowserClient();
    const realGetSession = supabase.auth.getSession.bind(supabase.auth);
    type SessionResponse = Awaited<ReturnType<typeof realGetSession>>;
    let releaseSession: (response: SessionResponse) => void = () => {};
    const restoring = new Promise<SessionResponse>((resolve) => {
      releaseSession = resolve;
    });
    const spy = vi.spyOn(supabase.auth, 'getSession').mockReturnValue(restoring);

    seedSession();
    seed('profiles', [profile({ role: 'admin' })]);

    const { router } = renderAppRoutes('/admin');

    expect(router.state.location.pathname).toBe('/admin');
    expect(screen.queryByRole('link', { name: 'Back to app' })).not.toBeInTheDocument();

    releaseSession(await realGetSession());

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/dashboard'), { timeout: 5000 });
    spy.mockRestore();
  });
});
