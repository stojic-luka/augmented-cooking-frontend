import { Container } from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';
import { AdminRecipesPage, AdminRecipesPageError, AdminRecipesPagePending, adminRecipesOptions } from '@features/admin';

export const Route = createFileRoute('/_admin/admin/recipes/')({
  loader: async ({ context }) => {
    await context.queryClient.fetchInfiniteQuery(adminRecipesOptions());
  },
  pendingComponent: AdminRecipesPagePending,
  errorComponent: AdminRecipesPageError,
  component: () => (
    <Container size="xl" py="xl">
      <AdminRecipesPage />
    </Container>
  ),
});
