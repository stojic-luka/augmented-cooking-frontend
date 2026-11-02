import { createFileRoute } from '@tanstack/react-router';
import { ModTicketsPage, ModTicketsPageError, ModTicketsPagePending, ticketQueueOptions } from '@features/moderator';

export const Route = createFileRoute('/_moderator/mod/tickets/')({
  loader: async ({ context }) => await context.queryClient.query(ticketQueueOptions()),
  pendingComponent: ModTicketsPagePending,
  errorComponent: ({ error }) => <ModTicketsPageError error={error} />,
  component: () => <ModTicketsPage />,
});
