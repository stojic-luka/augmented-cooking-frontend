import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { AuthUserProvider } from '@features/auth/providers/user';
import { theme } from '@styles/mantine';

/**
 * Test-app wrapper mirroring src/providers/Providers.tsx + the root route's
 * AuthUserProvider. Differences from production, both deliberate:
 *  - a fresh QueryClient per render, with retries off so error states are
 *    deterministic (production retries once with backoff);
 *  - a memory-history router built per render (production uses the browser
 *    history + generated route tree).
 */

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      {/* env="test" — jsdom has no layout, so Mantine's hide() middleware would
          mark detached popovers referenceHidden and hide them with display:none. */}
      <MantineProvider theme={theme} defaultColorScheme="light" env="test">
        <ModalsProvider>
          <Notifications />
          <AuthUserProvider>
            {children} {/**/}
          </AuthUserProvider>
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
}

export interface TestRouteSpec {
  path: string;
  component: () => ReactElement;
  /** Mirrors `validateSearch` on the real route files when needed. */
  validateSearch?: (search: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * Renders route specs under the full provider stack at `initialPath`.
 * Returns the Testing Library render result plus the router instance
 * (use `result.router.state.location` to assert navigations).
 */
export async function renderRoutes(routes: TestRouteSpec[], initialPath: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <AppProviders>
        <Outlet />
      </AppProviders>
    ),
  });

  const built = routes.map((spec) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: spec.path,
      component: spec.component,
      ...(spec.validateSearch ? { validateSearch: spec.validateSearch } : {}),
    }),
  );

  const router = createRouter({
    routeTree: rootRoute.addChildren(built),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    context: { queryClient: makeQueryClient() },
    defaultPreload: 'intent',
  });

  const result = render(<RouterProvider router={router} />);
  return { ...result, router };
}
