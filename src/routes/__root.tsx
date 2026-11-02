import { Outlet, createRootRouteWithContext } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Providers } from '@/providers';
import type { queryClient } from '@lib/query-client';

export const Route = createRootRouteWithContext<{
  queryClient: typeof queryClient;
}>()({
  component: () => {
    return (
      <Providers>
        <Outlet />
        {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
        {import.meta.env.DEV ? <ReactQueryDevtools position="bottom" buttonPosition="bottom-left" /> : null}
      </Providers>
    );
  },
});
