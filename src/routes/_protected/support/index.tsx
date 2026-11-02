import { Container } from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';
import { SupportPage } from '@features/support';

export const Route = createFileRoute('/_protected/support/')({
  component: () => (
    <Container size="lg" py="xl">
      <SupportPage />
    </Container>
  ),
});
