import { Container } from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';
import {
  AdminSystemPage,
  AdminSystemPageError,
  AdminSystemPagePending,
  adminPlansOptions,
  adminModelsOptions,
} from '@features/admin';

export const Route = createFileRoute('/_admin/admin/settings/')({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.query(adminPlansOptions()),
      context.queryClient.query(adminModelsOptions()),
    ]);
  },
  pendingComponent: AdminSystemPagePending,
  errorComponent: AdminSystemPageError,
  component: () => (
    <Container size="xl" py="xl">
      <AdminSystemPage />
    </Container>
  ),
});
