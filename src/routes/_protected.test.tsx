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
 * Role-gated dashboard entries in the protected sidebar. Tests run the REAL
 * generated route tree, so the nav rendering, the /admin and /mod index
 * redirects, and the group guards behave exactly as in production; the
 * session comes from seeded localStorage and MSW handles every network call.
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

describe('protected sidebar dashboard entries', () => {
  beforeEach(() => {
    clearSession();
    clearTables();
    queryClient.clear();
  });

  it('shows no dashboard entries to a regular user', async () => {
    seedSession();
    seed('profiles', [profile({ role: 'user' })]);
    seed('recipes', [dbRecipe()]);

    renderAppRoutes('/recipes/search');

    expect(await screen.findByRole('link', { name: 'My recipes' }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Admin dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Moderator dashboard' })).not.toBeInTheDocument();
  });

  it('shows only the moderator entry to a moderator', async () => {
    seedSession();
    seed('profiles', [profile({ role: 'moderator' })]);
    seed('recipes', [dbRecipe()]);

    renderAppRoutes('/recipes/search');

    expect(await screen.findByRole('link', { name: 'Moderator dashboard' }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Admin dashboard' })).not.toBeInTheDocument();
  });

  it('shows both entries to an admin (admins also moderate)', async () => {
    seedSession();
    seed('profiles', [profile({ role: 'admin' })]);
    seed('recipes', [dbRecipe()]);

    renderAppRoutes('/recipes/search');

    expect(await screen.findByRole('link', { name: 'Admin dashboard' }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Moderator dashboard' })).toBeInTheDocument();
  });

  it('navigates the admin entry through /admin onto the admin dashboard', async () => {
    seedSession();
    seed('profiles', [profile({ role: 'admin' })]);
    seed('recipes', [dbRecipe()]);
    const user = userEvent.setup();

    const { router } = renderAppRoutes('/recipes/search');

    await user.click(await screen.findByRole('link', { name: 'Admin dashboard' }, { timeout: 5000 }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/dashboard'), { timeout: 5000 });
  });

  it('navigates the moderator entry through /mod onto the moderation dashboard', async () => {
    seedSession();
    seed('profiles', [profile({ role: 'moderator' })]);
    seed('recipes', [dbRecipe()]);
    const user = userEvent.setup();

    const { router } = renderAppRoutes('/recipes/search');

    await user.click(await screen.findByRole('link', { name: 'Moderator dashboard' }, { timeout: 5000 }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/mod/dashboard'), { timeout: 5000 });
  });
});
