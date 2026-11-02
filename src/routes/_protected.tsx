import { AppShell, Burger, Group, NavLink, ScrollArea, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link, Outlet, createFileRoute, redirect, useLocation, useNavigate } from '@tanstack/react-router';
import {
  LuBookOpen,
  LuCalendarDays,
  LuChefHat,
  LuFolders,
  LuHeart,
  LuLifeBuoy,
  LuShield,
  LuShieldCheck,
  LuShoppingCart,
  LuStar,
  LuUser,
  LuBot,
} from 'react-icons/lu';
import { BrandLogo, ColorSchemeToggle, FullPageLoader, UserMenu } from '@components';
import { canAccessArea } from '@features/auth';
import { getSupabaseBrowserClient } from '@lib/supabase';
import { useAuthUser } from '@features/auth/providers/user';
import { RECIPES_SEARCH_PATH } from '@features/recipes';

const NAV_ITEMS = [
  { label: 'Explore recipes', icon: LuBookOpen, href: RECIPES_SEARCH_PATH },
  { label: 'My recipes', icon: LuChefHat, href: '/my-recipes' },
  { label: 'Favorites', icon: LuHeart, href: '/favorites' },
  { label: 'Collections', icon: LuFolders, href: '/collections' },
  { label: 'AI assistant', icon: LuBot, href: '/ai-assistant' },
  { label: 'Meal planner', icon: LuCalendarDays, href: '/planner' },
  { label: 'Shopping lists', icon: LuShoppingCart, href: '/shopping-list' },
  { label: 'Subscription', icon: LuStar, href: '/subscription' },
  { label: 'Profile', icon: LuUser, href: '/profile' },
  { label: 'Support', icon: LuLifeBuoy, href: '/support' },
];

// Staff-area entries, gated by the shared role model in features/auth — the
// same canAccessArea source the _admin/_moderator guards read. Admins get
// both entries, moderators only the moderation one, users neither.
const ADMIN_NAV_ITEM = { label: 'Admin dashboard', icon: LuShield, href: '/admin/dashboard' };
const MODERATOR_NAV_ITEM = { label: 'Moderator dashboard', icon: LuShieldCheck, href: '/mod/dashboard' };

function ProtectedShell() {
  const [opened, { toggle }] = useDisclosure(false);
  const { user, profile, isLoading, role, signOut } = useAuthUser();
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });

  if (isLoading || !role) {
    return <FullPageLoader label="Preparing your kitchen…" />;
  }

  const navItems = [
    ...NAV_ITEMS,
    ...(canAccessArea(role, 'admin') ? [ADMIN_NAV_ITEM] : []),
    ...(canAccessArea(role, 'moderator') ? [MODERATOR_NAV_ITEM] : []),
  ];

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
            <BrandLogo to="/recipes" />
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
          {navItems.map((item) => (
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
          <Text size="xs" c="dimmed">
            {profile?.subscription_tier === 'premium' ? 'Premium plan' : 'Free plan'}
          </Text>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}

export const Route = createFileRoute('/_protected')({
  beforeLoad: async ({ location }) => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();

    // The recipe explorer twin has a public counterpart, so anonymous
    // visitors fall through to the route's own beforeLoad, which redirects
    // to the public explorer (filters preserved) instead of the login wall.
    if (!data.session && !location.pathname.startsWith(RECIPES_SEARCH_PATH)) {
      throw redirect({ to: '/login', search: { next: location.href } });
    }
  },
  component: ProtectedShell,
});
