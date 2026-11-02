import { Container } from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';
import { RecipeImportForm } from '@features/recipes';

export const Route = createFileRoute('/_protected/recipes/import/')({
  component: () => (
    <Container size="lg" py="xl">
      <RecipeImportForm />
    </Container>
  ),
});
