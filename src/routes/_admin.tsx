import { AppShell, Badge, Burger, Group, NavLink, Paper, ScrollArea, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link, Outlet, createFileRoute, redirect, useLocation, useNavigate } from '@tanstack/react-router';
import { LuArrowLeft, LuBug, LuClipboardList, LuCpu, LuLayoutDashboard, LuUsers } from 'react-icons/lu';
import { BrandLogo, ColorSchemeToggle, FullPageLoader, UserMenu } from '@components';
import { getSupabaseBrowserClient } from '@lib/supabase';
import { canAccessArea } from '@features/auth';
import { useAuthUser } from '@features/auth/providers/user';
import { fetchProfile } from '@features/profile/services';
import { RECIPES_SEARCH_PATH } from '@features/recipes';

const NAV_ITEMS = [
  { label: 'Back to app', icon: LuArrowLeft, href: RECIPES_SEARCH_PATH },
  { label: 'System dashboard', icon: LuLayoutDashboard, href: '/admin/dashboard' },
  { label: 'User registry', icon: LuUsers, href: '/admin/users' },
  { label: 'Recipe registry', icon: LuClipboardList, href: '/admin/recipes' },
  { label: 'AI & system config', icon: LuCpu, href: '/admin/settings' },
  { label: 'Bug reports', icon: LuBug, href: '/admin/reports' },
];

function AdminShell() {
  const [opened, { toggle }] = useDisclosure(false);
  const { user, profile, isLoading, signOut } = useAuthUser();
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();

  if (isLoading) {
    return <FullPageLoader label="Preparing the admin panel…" />;
  }

  const handleLogout = async () => {
    await signOut();
    navigate({ to: '/' });
  };

  return (
    <AppShell header={{ height: 60 }} navbar={{ width: 280, breakpoint: 'sm', collapsed: { mobile: !opened } }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <BrandLogo />
            <Badge variant="light">Admin panel</Badge>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <ColorSchemeToggle />
            {user ? (
              <UserMenu
                email={user.email ?? ''}
                displayName={profile?.display_name ?? user.email ?? ''}
                avatarUrl={profile?.avatar_url}
                onLogout={handleLogout}
              />
            ) : null}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section component={ScrollArea} grow>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              component={Link}
              to={item.href}
              label={item.label}
              leftSection={<item.icon size={15} />}
              active={pathname === item.href}
              mb={4}
            />
          ))}
        </AppShell.Section>
        <AppShell.Section p="md">
          <Paper withBorder p="xs">
            <Text size="xs" fw={600}>
              Signed in as {profile?.display_name ?? user?.email ?? 'admin'}
            </Text>
          </Paper>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}

export const Route = createFileRoute('/_admin')({
  beforeLoad: async ({ location }) => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();

    if (!data.session) {
      throw redirect({ to: '/login', search: { next: location.href } });
    }

    const profile = await fetchProfile(data.session.user.id);
    const role = profile?.role ?? 'user';

    if (!canAccessArea(role, 'admin')) {
      throw redirect({ to: '/recipes' });
    }
  },
  component: AdminShell,
});
