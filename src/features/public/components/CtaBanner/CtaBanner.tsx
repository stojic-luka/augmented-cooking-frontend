import { Box, Button, Container, Group, Stack, Text, Title } from '@mantine/core';
import { Link } from '@tanstack/react-router';

export function CtaBanner() {
  return (
    <Box py={{ base: 56, md: 96 }}>
      <Container size="lg">
        <Stack
          align="center"
          ta="center"
          gap="lg"
          px={{ base: 'xl', md: 80 }}
          py={{ base: 48, md: 72 }}
          style={{
            borderRadius: 'var(--mantine-radius-lg)',
            border: '1px solid var(--mantine-color-default-border)',
          }}
        >
          <Title order={2} fz={{ base: 'h3', md: 'h2' }}>
            Your next favorite meal starts with one prompt
          </Title>
          <Text c="dimmed" maw={480}>
            Join Augmented Cooking free — plan smarter, shop faster, and cook with an AI sous-chef at your side.
          </Text>
          <Group gap="sm">
            <Button component={Link} to="/sign-up" size="lg" variant="filled">
              Create free account
            </Button>
            <Button component={Link} to="/recipes" size="lg" variant="default">
              Browse recipes first
            </Button>
          </Group>
          <Text size="xs" c="dimmed">
            No credit card. Cancel anytime.
          </Text>
        </Stack>
      </Container>
    </Box>
  );
}
