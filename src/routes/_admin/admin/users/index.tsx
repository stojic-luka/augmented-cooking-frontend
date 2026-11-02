import { Container } from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';
import { AdminUsersPage, AdminUsersPageError, AdminUsersPagePending, adminUsersOptions } from '@features/admin';

export const Route = createFileRoute('/_admin/admin/users/')({
  loader: async ({ context }) => {
    await context.queryClient.fetchInfiniteQuery(adminUsersOptions());
  },
  pendingComponent: AdminUsersPagePending,
  errorComponent: AdminUsersPageError,
  component: () => (
    <Container size="xl" py="xl">
      <AdminUsersPage />
    </Container>
  ),
});
