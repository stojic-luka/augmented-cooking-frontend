import { createFileRoute } from '@tanstack/react-router';
import {
  ModDashboardPage,
  ModDashboardPageError,
  ModDashboardPagePending,
  pendingRecipesOptions,
} from '@features/moderator';

export const Route = createFileRoute('/_moderator/mod/dashboard/')({
  loader: async ({ context }) => {
    await context.queryClient.query(pendingRecipesOptions());
  },
  pendingComponent: ModDashboardPagePending,
  errorComponent: ({ error }) => <ModDashboardPageError error={error} />,
  component: () => <ModDashboardPage />,
});
