import { Container } from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';
import { RecipeForm } from '@features/recipes';

export const Route = createFileRoute('/_protected/recipes/create/')({
  component: () => (
    <Container size="lg" py="xl">
      <RecipeForm title="Create recipe" description="Share a dish you love — or keep it private as your personal cookbook." />
    </Container>
  ),
});
