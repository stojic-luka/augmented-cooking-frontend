import { Container } from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';
import {
  AdminDashboardPage,
  AdminDashboardPageError,
  AdminDashboardPagePending,
  systemMetricsOptions,
} from '@features/admin';

export const Route = createFileRoute('/_admin/admin/dashboard/')({
  loader: async ({ context }) => {
    await context.queryClient.query(systemMetricsOptions());
  },
  pendingComponent: AdminDashboardPagePending,
  errorComponent: AdminDashboardPageError,
  component: () => (
    <Container size="xl" py="xl">
      <AdminDashboardPage />
    </Container>
  ),
});
