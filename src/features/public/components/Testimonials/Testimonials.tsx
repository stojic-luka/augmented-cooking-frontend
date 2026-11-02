import { Box, Container, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { LuQuote, LuStar } from 'react-icons/lu';

const TESTIMONIALS = [
  {
    quote:
      'The weekly planner cut my Sunday meal-prep from two hours of scrolling to ten minutes. The shopping list alone is worth it.',
    name: 'Maria K.',
    role: 'Home cook, meal-prep convert',
  },
  {
    quote:
      'I pasted a link to my grandmother’s stew recipe and the copilot rebuilt it with gram measurements and dietary swaps. Wild.',
    name: 'Tomás R.',
    role: 'Recipe hoarder',
  },
  {
    quote:
      'Guided cooking mode is the first kitchen app my partner and I actually fight over who gets to use it.',
    name: 'Priya S.',
    role: 'Weekend chef',
  },
] as const;

/** Testimonial strip — placeholder copy; swap for real user quotes when you have them. */
export function Testimonials() {
  return (
    <Box py={{ base: 56, md: 96 }}>
      <Container size="lg">
        <Stack align="center" mb={{ base: 'lg', md: 60 }}>
          <Title order={2} ta="center" fz={{ base: 'h3', md: 'h2' }}>
            Loved in busy kitchens
          </Title>
          <Group gap={4}>
            {Array.from({ length: 5 }).map((_, index) => (
              <LuStar key={index} size={18} color="var(--warning)" fill="var(--warning)" />
            ))}
          </Group>
        </Stack>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing={30}>
          {TESTIMONIALS.map((testimonial) => (
            <Paper key={testimonial.name} withBorder radius={12} p="xl" pos="relative">
              <ThemeIcon variant="light" color="yellow" size={30} pos="absolute" top={-15} left={24}>
                <LuQuote size={15} />
              </ThemeIcon>
              <Text size="sm" style={{ lineHeight: 1.7 }} mt="sm">
                “{testimonial.quote}”
              </Text>
              <Stack gap={2} mt="md">
                <Text size="sm" fw={600}>
                  {testimonial.name}
                </Text>
                <Text size="xs" c="dimmed">
                  {testimonial.role}
                </Text>
              </Stack>
            </Paper>
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  );
}