import { Badge, Group, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import type { IconType } from 'react-icons';
import type { ReactNode } from 'react';

export interface AuthHighlight {
  title: string;
  description: string;
  icon: IconType;
  color: string;
}

interface AuthRouteShellProps {
  title: string;
  description: string;
  badgeLabel?: string;
  highlights?: AuthHighlight[];
  children: ReactNode;
}

/** Shared page scaffold for auth routes: centered header, surface card, optional highlights. */
export function AuthRouteShell({ title, description, badgeLabel, highlights, children }: Readonly<AuthRouteShellProps>) {
  return (
    <Stack gap="xl">
      <Stack gap="xs" align="center" ta="center">
        {badgeLabel ? (
          <Badge variant="light" size="lg" maw="fit-content">
            {badgeLabel}
          </Badge>
        ) : null}
        <Title order={2} fz={{ base: 'xl', md: 'h2' }}>
          {title}
        </Title>
        <Text size="sm" c="dimmed" maw={440}>
          {description}
        </Text>
      </Stack>

      {highlights && highlights.length > 0 ? (
        // Three side-by-side cards don't fit a phone — hide them below xs.
        <Group grow gap="sm" visibleFrom="xs" align="stretch">
          {highlights.map((highlight) => (
            <Paper key={highlight.title} withBorder radius={12} p="md">
              <Stack gap={4}>
                <Group gap="xs" wrap="nowrap">
                  <ThemeIcon variant="light" color={highlight.color} size="sm">
                    <highlight.icon size={16} />
                  </ThemeIcon>
                  <Text size="sm" fw={600}>
                    {highlight.title}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed">
                  {highlight.description}
                </Text>
              </Stack>
            </Paper>
          ))}
        </Group>
      ) : null}

      {/* No bg override: Paper's default surface sits subtly above the page in both color schemes. */}
      <Paper withBorder radius={14} p={{ base: 'lg', md: 'xl' }}>
        {children}
      </Paper>
    </Stack>
  );
}
