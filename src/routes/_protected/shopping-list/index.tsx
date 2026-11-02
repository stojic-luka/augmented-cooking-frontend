import { Container, Title, Text } from '@mantine/core';
import { createFileRoute } from '@tanstack/react-router';
import { ShoppingListManager } from '@features/shopping';

export const Route = createFileRoute('/_protected/shopping-list/')({
  component: () => (
    <Container size="lg" py="xl">
      <Title order={1}>Shopping lists</Title>
      <Text c="dimmed" mb="xl">
        Check off items as you shop, or send the list straight to a grocery partner.
      </Text>
      <ShoppingListManager />
    </Container>
  ),
});
