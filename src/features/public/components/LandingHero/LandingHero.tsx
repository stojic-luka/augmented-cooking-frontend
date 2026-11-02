import { Badge, Box, Button, Group, Image, Stack, Text, Title } from '@mantine/core';
import { Link } from '@tanstack/react-router';

export function LandingHero() {
  return (
    <Box py={{ base: 56, md: 96 }}>
      <Group align="center" justify="space-between" gap={48} grow>
        <Stack gap="xl" maw={560}>
          <Badge color="brand" variant="light" size="lg" maw="fit-content">
            AI-Powered Culinary Experience
          </Badge>

          <Title order={1} fz={{ base: 38, md: 44, lg: 60 }} lh={1.08}>
            Cook <Text span inherit c="brand">Smarter</Text> with Augmented Intelligence
          </Title>

          <Text size="lg" c="dimmed" maw={520}>
            Experience the future of home cooking. From AI-generated recipes to smart shopping lists and guided cooking
            modes, Augmented Cooking is your personal sous-chef.
          </Text>

          <Group gap="sm">
            <Button component={Link} to="/recipes" size="xl" radius="md" variant="filled">
              Explore Recipes
            </Button>
            <Button component={Link} to="/sign-up" size="xl" radius="md" variant="default">
              Join Now
            </Button>
          </Group>

          <Group gap="xs" c="dimmed" visibleFrom="xs">
            <Text size="sm">Free to start</Text>
            <Text size="sm">·</Text>
            <Text size="sm">No credit card required</Text>
            <Text size="sm">·</Text>
            <Text size="sm">Your recipes stay yours</Text>
          </Group>
        </Stack>

        <Box visibleFrom="sm" maw={480} w="100%" style={{ position: 'relative' }}>
          <Image
            src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&auto=format&fit=crop&q=80"
            alt="A plated meal prepared with the help of AI cooking tools"
            radius="xl"
            h={440}
            fit="cover"
          />
        </Box>
      </Group>
    </Box>
  );
}
