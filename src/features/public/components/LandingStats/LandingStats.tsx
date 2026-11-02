import { Box, Container, SimpleGrid, Stack, Text } from '@mantine/core';

const STATS = [
  { value: '12k+', label: 'Recipes generated' },
  { value: '4.8★', label: 'Average meal rating' },
  { value: '30 min', label: 'Median week plan setup' },
  { value: '100%', label: 'Free core features' },
] as const;

/**
 * Social-proof band. Numbers are illustrative placeholders —
 * wire these to real metrics before launch.
 */
export function LandingStats() {
  return (
    <Box py={{ base: 'xl', md: 56 }}>
      <Container size="lg">
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={{ base: 'lg', md: 'xl' }}>
          {STATS.map((stat) => (
            <Stack key={stat.label} gap={4} className="align-center-sm-start" ta={{ base: 'center', sm: 'left' }}>
              <Text component="h2" c="brand" fw={600} fz={{ base: 'h2', md: 'h1' }}>
                {stat.value}
              </Text>
              <Text size="sm" c="dimmed">
                {stat.label}
              </Text>
            </Stack>
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  );
}
