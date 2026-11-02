import { Button, Container, Group, Stack, Text, Title } from '@mantine/core';
import { LuTriangleAlert } from 'react-icons/lu';

export interface ModDashboardPageErrorProps {
  error: unknown;
}

/** Route-level error boundary content for the moderation dashboard. */
export function ModDashboardPageError({ error }: Readonly<ModDashboardPageErrorProps>) {
  const message =
    error instanceof Error ? error.message : 'Something went wrong while loading the moderation dashboard.';

  return (
    <Container size="xl" py="xl">
      <Stack gap="sm">
        <Group gap="xs">
          <LuTriangleAlert size={18} color="var(--danger)" />
          <Title order={2}>Moderation dashboard failed to load</Title>
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