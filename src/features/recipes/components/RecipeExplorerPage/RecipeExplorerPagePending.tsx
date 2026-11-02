import { Container, Paper, SimpleGrid, Skeleton, Stack } from '@mantine/core';

/** Route-level skeleton for the recipe explorer. */
export function RecipeExplorerPagePending() {
  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <Stack gap={4}>
          <Skeleton height={34} radius="sm" width={280} />
          <Skeleton height={14} radius="sm" width={420} />
        </Stack>
        <Paper p="md" radius={12} withBorder>
          <Stack gap="md">
            <Skeleton height={36} radius="sm" />
            <Skeleton height={36} radius="sm" width="50%" />
          </Stack>
        </Paper>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} height={380} radius="md" />
          ))}
        </SimpleGrid>
      </Stack>
    </Container>
  );
}