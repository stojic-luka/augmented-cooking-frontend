import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryClient } from '@lib/query-client';
import { getSupabaseBrowserClient } from '@lib/supabase';
import { routeTree } from '@/routeTree.gen';
import { dbRecipe } from '@/test/fixtures/db';
import { clearTables, seed } from '@/test/fixtures/tables';
import { clearSession, seedSession } from '@/test/auth';

/**
 * Two-way auth redirects between the public explorer (/recipes) and its
 * protected twin (/recipes/search). Tests run the REAL generated route tree,
 * so the beforeLoad guards, the layout exemption in _protected.tsx, and both
 * shells behave exactly as in production; the session is supplied through
 * seeded localStorage and MSW handles every network call. The shared query
 * client is cleared between tests since the production root mounts it.
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

describe('recipes search auth redirects', () => {
  beforeEach(() => {
    clearSession();
    clearTables();
    queryClient.clear();
  });

  it('sends a signed-in visitor from the public explorer to the protected twin, keeping the query', async () => {
    seedSession();
    seed('recipes', [dbRecipe({ title: 'Tomato Rice' })]);
    const { router } = renderAppRoutes('/recipes?q=tomato&sort=rating');

    await waitFor(() => expect(router.state.location.pathname).toBe('/recipes/search'));
    expect(router.state.location.search).toMatchObject({ q: 'tomato', sort: 'rating' });

    // Protected chrome: the sidebar from the _protected layout…
    expect(await screen.findByRole('link', { name: 'My recipes' }, { timeout: 5000 })).toBeInTheDocument();
    // …with the same shared explorer UI inside it.
    expect(await screen.findByText('1 recipe found', {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it('sends an anonymous visitor from the protected twin to the public explorer, keeping the query', async () => {
    const { router } = renderAppRoutes('/recipes/search?q=tomato');

    await waitFor(() => expect(router.state.location.pathname).toBe('/recipes'));
    expect(router.state.location.search).toMatchObject({ q: 'tomato' });

    // Public chrome: no sidebar, and the sign-in entry points of the public shell.
    expect((await screen.findAllByRole('link', { name: 'Sign in' }, { timeout: 5000 })).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'My recipes' })).not.toBeInTheDocument();
  });

  it('keeps anonymous visitors on the public explorer unchanged', async () => {
    seed('recipes', [dbRecipe({ title: 'Tomato Rice' })]);
    const { router } = renderAppRoutes('/recipes?q=tomato');

    expect(await screen.findByText('1 recipe found', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/recipes');
    expect(screen.getByText('Tomato Rice')).toBeInTheDocument();
  });

  it('keeps signed-in visitors on the protected twin when they land there directly', async () => {
    seedSession();
    const { router } = renderAppRoutes('/recipes/search?sort=rating');

    await waitFor(() => expect(router.state.location.pathname).toBe('/recipes/search'));
    expect(await screen.findByRole('link', { name: 'My recipes' }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('makes no redirect decision while the session is still restoring', async () => {
    // Hold getSession() open so the guard sits inside the restoring state;
    // the router must stay put until it resolves, then follow the session.
    const supabase = getSupabaseBrowserClient();
    const realGetSession = supabase.auth.getSession.bind(supabase.auth);
    type SessionResponse = Awaited<ReturnType<typeof realGetSession>>;
    let releaseSession: (response: SessionResponse) => void = () => {};
    const restoring = new Promise<SessionResponse>((resolve) => {
      releaseSession = resolve;
    });
    vi.spyOn(supabase.auth, 'getSession').mockReturnValue(restoring);

    seedSession();
    const { router } = renderAppRoutes('/recipes?q=tomato');

    expect(router.state.location.pathname).toBe('/recipes');
    expect(screen.queryByRole('link', { name: 'My recipes' })).not.toBeInTheDocument();

    releaseSession(await realGetSession());

    await waitFor(() => expect(router.state.location.pathname).toBe('/recipes/search'));
    expect(router.state.location.search).toMatchObject({ q: 'tomato' });
  });
});
