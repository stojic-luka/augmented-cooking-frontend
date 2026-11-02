import { Button, Container, Group, Stack, Text, Title } from '@mantine/core';
import { useRouter } from '@tanstack/react-router';
import { LuTriangleAlert } from 'react-icons/lu';

export interface RecipeExplorerPageErrorProps {
  error: unknown;
}

/** Route-level error boundary content for the recipe explorer. */
export function RecipeExplorerPageError({ error }: Readonly<RecipeExplorerPageErrorProps>) {
  const router = useRouter();
  const message =
    error instanceof Error ? error.message : 'Something went wrong while loading recipes.';

  return (
    <Container size="lg" py="xl">
      <Stack gap="sm">
        <Group gap="xs">
          <LuTriangleAlert size={18} color="var(--danger)" />
          <Title order={2}>Recipe explorer failed to load</Title>
        </Group>
        <Text size="sm" c="dimmed">
          {message}
        </Text>
        <Group>
          <Button onClick={() => router.invalidate()}>Try again</Button>
        </Group>
      </Stack>
    </Container>
  );
}