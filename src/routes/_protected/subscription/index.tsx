import { Container } from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';
import { SubscriptionPage } from '@features/payment';

export const Route = createFileRoute('/_protected/subscription/')({
  component: () => (
    <Container size="md" py="xl">
      <SubscriptionPage />
    </Container>
  ),
});
