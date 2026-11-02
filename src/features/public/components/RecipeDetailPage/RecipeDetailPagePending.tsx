import { Container, Skeleton, Stack } from '@mantine/core';

/** Route-level skeleton for the recipe detail page. */
export function RecipeDetailPagePending() {
  return (
    <Container size="lg" py="xl">
      <Stack gap="md">
        <Skeleton height={300} radius={12} />
        <Skeleton height={32} width={320} radius={8} />
        <Skeleton height={80} radius={8} />
      </Stack>
    </Container>
  );
}