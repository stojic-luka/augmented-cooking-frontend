import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { queryClient } from '@lib/query-client';
import { routeTree } from '@/routeTree.gen';
import { dbRecipe, profile } from '@/test/fixtures/db';
import { clearTables, seed } from '@/test/fixtures/tables';
import { clearSession, seedSession } from '@/test/auth';

/**
 * The /mod area: index redirect onto the moderation dashboard, the group's
 * session/role guard (admins pass it too), and the "Back to app" entry.
 * Tests run the REAL generated route tree with seeded localStorage sessions;
 * every network call goes through MSW.
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

describe('/mod routing', () => {
  beforeEach(() => {
    clearSession();
    clearTables();
    queryClient.clear();
  });

  it('redirects a moderator from /mod onto the moderation dashboard', async () => {
    seedSession();
    seed('profiles', [profile({ role: 'moderator' })]);

    const { router } = renderAppRoutes('/mod');

    await waitFor(() => expect(router.state.location.pathname).toBe('/mod/dashboard'), { timeout: 5000 });
    expect(await screen.findByRole('link', { name: 'Back to app' }, { timeout: 5000 })).toBeInTheDocument();
  });

  it('lets an admin through (admins also moderate)', async () => {
    seedSession();
    seed('profiles', [profile({ role: 'admin' })]);

    const { router } = renderAppRoutes('/mod');

    await waitFor(() => expect(router.state.location.pathname).toBe('/mod/dashboard'), { timeout: 5000 });
  });

  it('sends an anonymous visitor to the login wall, preserving the target', async () => {
    const { router } = renderAppRoutes('/mod');

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'), { timeout: 5000 });
    expect(router.state.location.search).toMatchObject({ next: '/mod' });
  });

  it('bounces a regular user back to the app', async () => {
    seedSession();
    seed('profiles', [profile({ role: 'user' })]);
    seed('recipes', [dbRecipe()]);

    const { router } = renderAppRoutes('/mod');

    // The guard redirects to /recipes; its public twin then hands the
    // signed-in user to the protected explorer.
    await waitFor(() => expect(router.state.location.pathname).toBe('/recipes/search'), { timeout: 5000 });
  });

  it('returns to the app via the "Back to app" entry', async () => {
    seedSession();
    seed('profiles', [profile({ role: 'moderator' })]);
    const user = userEvent.setup();

    const { router } = renderAppRoutes('/mod');
    await user.click(await screen.findByRole('link', { name: 'Back to app' }, { timeout: 5000 }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/recipes/search'), { timeout: 5000 });
  });
});
