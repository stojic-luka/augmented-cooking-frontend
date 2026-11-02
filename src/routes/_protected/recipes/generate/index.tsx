import { Container } from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';
import { AiRecipeGeneratorPage } from '@features/ai';

export const Route = createFileRoute('/_protected/recipes/generate/')({
  component: () => (
    <Container size="lg" py="xl">
      <AiRecipeGeneratorPage />
    </Container>
  ),
});
