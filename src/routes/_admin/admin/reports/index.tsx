import { Container } from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';
import {
  AdminBugReportsPage,
  AdminBugReportsPageError,
  AdminBugReportsPagePending,
  bugReportsOptions,
} from '@features/admin';

export const Route = createFileRoute('/_admin/admin/reports/')({
  loader: async ({ context }) => {
    await context.queryClient.fetchInfiniteQuery(bugReportsOptions());
  },
  pendingComponent: AdminBugReportsPagePending,
  errorComponent: AdminBugReportsPageError,
  component: () => (
    <Container size="xl" py="xl">
      <AdminBugReportsPage />
    </Container>
  ),
});
