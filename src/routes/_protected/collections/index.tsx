import { Container } from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';
import { CollectionsPage } from '@features/collections';

export const Route = createFileRoute('/_protected/collections/')({
  component: () => (
    <Container size="lg" py="xl">
      <CollectionsPage />
    </Container>
  ),
});
