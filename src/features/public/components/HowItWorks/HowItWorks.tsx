import { Box, Container, Group, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { LuBot, LuLink, LuTable } from 'react-icons/lu';

const STEPS = [
  {
    icon: LuLink,
    color: 'brand',
    title: 'Import or generate',
    description: 'Paste any recipe URL, or describe what you crave and let the copilot draft it.',
  },
  {
    icon: LuBot,
    color: 'yellow',
    title: 'Plan your week',
    description: 'Turn recipes into a balanced meal plan that respects your diet and time.',
  },
  {
    icon: LuTable,
    color: 'green',
    title: 'Cook and shop',
    description: 'Get a synced shopping list, then follow guided cooking mode step by step.',
  },
] as const;

/** Three-step explainer — the bridge between features and the signup CTA. */
export function HowItWorks() {
  return (
    <Box py={{ base: 56, md: 96 }}>
      <Container size="lg">
        <Stack align="center" mb={{ base: 'lg', md: 60 }}>
          <Title order={2} ta="center" fz={{ base: 'h3', md: 'h2' }}>
            From craving to plate in three steps
          </Title>
          <Text c="dimmed" ta="center" maw={520}>
            No spreadsheets, no bookmark chaos — one flow from idea to dinner.
          </Text>
        </Stack>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing={30}>
          {STEPS.map((step, index) => (
            <Stack
              key={step.title}
              gap="sm"
              className="align-center-md-start"
              ta={{ base: 'center', md: 'left' }}
            >
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon variant="light" color={step.color} size={36}>
                  <step.icon size={18} />
                </ThemeIcon>
                <Text fz="h1" fw={600} c="dimmed" lh={1} style={{ opacity: 0.5 }}>
                  {index + 1}
                </Text>
              </Group>
              <Text fw={600}>{step.title}</Text>
              <Text size="sm" c="dimmed" maw={300} style={{ lineHeight: 1.6 }}>
                {step.description}
              </Text>
            </Stack>
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  );
}