import { Container, Group, Paper, Skeleton, Stack } from '@mantine/core';

/** Route-level skeleton for the support-ticket page. */
export function ModTicketsPagePending() {
  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Skeleton height={36} radius="md" width={240} />
        <Group align="flex-start" gap="lg">
          <Stack gap="xs" miw={300}>
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} height={72} radius="md" />
            ))}
          </Stack>
          <Paper withBorder radius={12} p="md" style={{ flex: 1, minWidth: 0 }} mih={320}>
            <Stack gap="sm">
              <Skeleton height={20} width="50%" />
              <Skeleton height={12} width="35%" />
              <Skeleton height={16} width="70%" mt="md" />
              <Skeleton height={16} width="55%" />
            </Stack>
          </Paper>
        </Group>
      </Stack>
    </Container>
  );
}
