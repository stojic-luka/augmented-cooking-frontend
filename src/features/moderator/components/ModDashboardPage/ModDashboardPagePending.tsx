import { Card, Container, SimpleGrid, Skeleton, Stack } from '@mantine/core';

/** Route-level skeleton for the moderation dashboard. */
export function ModDashboardPagePending() {
  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <Skeleton height={36} radius="md" width={320} />
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <Skeleton height={12} width="60%" mb="sm" />
              <Skeleton height={26} width="40%" />
            </Card>
          ))}
        </SimpleGrid>
        <Stack gap="sm">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} height={88} radius="md" />
          ))}
        </Stack>
      </Stack>
    </Container>
  );
}