import { AppShell, Badge, Burger, Group, NavLink, ScrollArea } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link, Outlet, createFileRoute, redirect, useLocation, useNavigate } from '@tanstack/react-router';
import { LuArrowLeft, LuLayoutDashboard, LuMessageSquareWarning, LuTicket } from 'react-icons/lu';
import { BrandLogo, ColorSchemeToggle, FullPageLoader, UserMenu } from '@components';
import { getSupabaseBrowserClient } from '@lib/supabase';
import { canAccessArea } from '@features/auth';
import { useAuthUser } from '@features/auth/providers/user';
import { fetchProfile } from '@features/profile/services';
import { RECIPES_SEARCH_PATH } from '@features/recipes';

const NAV_ITEMS = [
  { label: 'Back to app', icon: LuArrowLeft, href: RECIPES_SEARCH_PATH },
  { label: 'Mod dashboard', icon: LuLayoutDashboard, href: '/mod/dashboard' },
  { label: 'Content reviews', icon: LuMessageSquareWarning, href: '/mod/reviews' },
  { label: 'Support tickets', icon: LuTicket, href: '/mod/tickets' },
];

function ModeratorShell() {
  const [opened, { toggle }] = useDisclosure(false);
  const { user, profile, isLoading, signOut } = useAuthUser();
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();

  if (isLoading) {
    return <FullPageLoader label="Preparing the moderation queue…" />;
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
            <Badge variant="default">Moderator portal</Badge>
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
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}

export const Route = createFileRoute('/_moderator')({
  beforeLoad: async ({ location }) => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();

    if (!data.session) {
      throw redirect({ to: '/login', search: { next: location.href } });
    }

    const profile = await fetchProfile(data.session.user.id);
    const role = profile?.role ?? 'user';

    if (!canAccessArea(role, 'moderator')) {
      throw redirect({ to: '/recipes' });
    }
  },
  component: ModeratorShell,
});
