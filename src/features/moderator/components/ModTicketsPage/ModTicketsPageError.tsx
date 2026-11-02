import { Button, Container, Group, Stack, Text, Title } from '@mantine/core';
import { LuTriangleAlert } from 'react-icons/lu';

export interface ModTicketsPageErrorProps {
  error: unknown;
}

/** Route-level error boundary content for the support-ticket page. */
export function ModTicketsPageError({ error }: Readonly<ModTicketsPageErrorProps>) {
  const message = error instanceof Error ? error.message : 'Something went wrong while loading the ticket queue.';

  return (
    <Container size="xl" py="xl">
      <Stack gap="sm">
        <Group gap="xs">
          <LuTriangleAlert size={18} color="var(--danger)" />
          <Title order={2}>Support tickets failed to load</Title>
        </Group>
        <Text size="sm" c="dimmed">
          {message}
        </Text>
        <Group>
          <Button variant="subtle" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}