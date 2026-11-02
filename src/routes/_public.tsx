import { ActionIcon, AppShell, Box, Button, Container, Group, NavLink, Skeleton, Text, UnstyledButton } from '@mantine/core';
import { Link, Outlet, createFileRoute, useMatchRoute, useNavigate } from '@tanstack/react-router';
import { LuBookOpen } from 'react-icons/lu';
import { BrandLogo, ColorSchemeToggle, UserMenu } from '@components';
import { useAuthUser } from '@features/auth/providers/user';

const CURRENT_YEAR = new Date().getFullYear();

function PublicShell() {
  const { isAuthed, isLoading, user, profile, signOut } = useAuthUser();
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();

  const handleLogout = async () => {
    await signOut();
    navigate({ to: '/' });
  };

  return (
    <AppShell header={{ height: 60 }} padding={0} footer={{ height: 60 }}>
      <AppShell.Header>
        <Container size="xl" h="100%">
          <Group h="100%" justify="space-between" wrap="nowrap" gap="sm">
            <BrandLogo />

            <Group gap="xs" wrap="nowrap">
              {/* Full link above sm, icon-only below to keep the bar compact on phones. */}
              <Box visibleFrom="sm">
                <NavLink
                  component={Link}
                  to="/recipes"
                  label="Explore recipes"
                  leftSection={<LuBookOpen size={15} />}
                  active={Boolean(matchRoute({ to: '/recipes' }))}
                />
              </Box>
              <ActionIcon
                component={Link}
                to="/recipes"
                variant="subtle"
                size={28}
                radius={7}
                aria-label="Explore recipes"
                hiddenFrom="sm"
              >
                <LuBookOpen size={15} />
              </ActionIcon>

              <ColorSchemeToggle />

              {isLoading ? (
                // Holds the header's width so it doesn't snap when the session resolves.
                <Skeleton circle width={32} height={32} />
              ) : isAuthed && user ? (
                <UserMenu
                  email={user.email ?? ''}
                  displayName={profile?.display_name ?? user.email ?? ''}
                  avatarUrl={profile?.avatar_url}
                  onLogout={handleLogout}
                />
              ) : (
                <>
                  <Button component={Link} to="/login" variant="subtle">
                    Sign in
                  </Button>
                  <Button component={Link} to="/sign-up" visibleFrom="xs">
                    Join now
                  </Button>
                </>
              )}
            </Group>
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>

      <AppShell.Footer>
        <Container size="xl" h="100%">
          <Group h="100%" justify="space-between" gap="sm" wrap="wrap">
            <Text size="sm" c="dimmed">
              © {CURRENT_YEAR} Augmented Cooking
            </Text>

            <Group gap="lg" wrap="wrap">
              <UnstyledButton component={Link} to="/recipes" size="sm" c="dimmed" style={{ textDecoration: 'none' }}>
                Recipes
              </UnstyledButton>
              <UnstyledButton component={Link} to="/login" size="sm" c="dimmed" style={{ textDecoration: 'none' }}>
                Sign in
              </UnstyledButton>
              <UnstyledButton component={Link} to="/sign-up" size="sm" c="dimmed" style={{ textDecoration: 'none' }}>
                Join now
              </UnstyledButton>
              <Text size="sm" c="dimmed" visibleFrom="sm">
                Cook smarter with AI
              </Text>
            </Group>
          </Group>
        </Container>
      </AppShell.Footer>
    </AppShell>
  );
}

export const Route = createFileRoute('/_public')({
  component: PublicShell,
});
