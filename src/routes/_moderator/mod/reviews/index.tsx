import { createFileRoute } from '@tanstack/react-router';
import {
  ModDashboardPage,
  ModDashboardPageError,
  ModDashboardPagePending,
  moderationReviewsOptions,
} from '@features/moderator';

export const Route = createFileRoute('/_moderator/mod/reviews/')({
  loader: async ({ context }) => {
    await context.queryClient.query(moderationReviewsOptions());
  },
  pendingComponent: ModDashboardPagePending,
  errorComponent: ({ error }) => <ModDashboardPageError error={error} />,
  component: () => <ModDashboardPage initialTab="reviews" />,
});
