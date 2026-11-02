import { Box, Container, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { LuBrain, LuCalendar, LuShoppingCart, LuSparkles } from 'react-icons/lu';
import type { IconType } from 'react-icons';

interface FeatureProps {
  icon: IconType;
  title: string;
  description: string;
  color: string;
}

function Feature({ icon: Icon, title, description, color }: Readonly<FeatureProps>) {
  return (
    // Hover lift comes from the shared .hover-lift utility (globals.css): 2px rise + shadow.
    <Paper withBorder p="xl" radius={12} className="hover-lift">
      <ThemeIcon size={40} variant="light" color={color}>
        <Icon size={20} />
      </ThemeIcon>
      <Text mt="sm" mb={7} fw={600}>
        {title}
      </Text>
      <Text size="sm" c="dimmed" style={{ lineHeight: 1.6 }}>
        {description}
      </Text>
    </Paper>
  );
}

export function FeaturesGrid() {
  const features = [
    {
      icon: LuBrain,
      title: 'AI Recipe Copilot',
      description: 'Generate, modify and optimize recipes with personalized AI instructions.',
      color: 'brand',
    },
    {
      icon: LuCalendar,
      title: 'Smart Planner',
      description: 'Automatically generate weekly meal plans based on your dietary preferences.',
      color: 'yellow',
    },
    {
      icon: LuShoppingCart,
      title: 'Dynamic Lists',
      description: 'Sync shopping lists directly from your planner and order ingredients instantly.',
      color: 'green',
    },
    {
      icon: LuSparkles,
      title: 'Recipe Scraper',
      description: 'Import recipes from any website with a single URL. Our AI handles the rest.',
      color: 'pink',
    },
  ] satisfies FeatureProps[];

  return (
    <Box py={{ base: 56, md: 96 }}>
      <Container size="lg">
        <Stack align="center" mb={{ base: 'lg', md: 60 }}>
          <Title order={2} ta="center" fz={{ base: 'h3', md: 'h2' }}>
            Everything you need to master your kitchen
          </Title>
          <Text c="dimmed" ta="center" maw={560}>
            Powerful tools designed for home cooks, powered by cutting-edge AI.
          </Text>
        </Stack>

        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing={30}>
          {features.map((feature) => (
            <Feature key={feature.title} {...feature} />
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  );
}