import { Avatar, Menu, Text, UnstyledButton } from '@mantine/core';
import { useNavigate } from '@tanstack/react-router';
import { LuLogOut, LuSettings, LuUser } from 'react-icons/lu';

interface UserMenuProps {
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  onLogout: () => void;
}

export function UserMenu({ email, displayName, avatarUrl, onLogout }: Readonly<UserMenuProps>) {
  const navigate = useNavigate();

  return (
    <Menu width={230}>
      <Menu.Target>
        <UnstyledButton aria-label="Account menu">
          <Avatar
            size="sm"
            color="brand"
            src={avatarUrl ?? undefined}
            name={displayName || email}
          />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label styles={{ label: { textTransform: 'none', letterSpacing: 'normal' } }}>
          <Text size="xs" truncate maw={180}>
            {email}
          </Text>
        </Menu.Label>
        <Menu.Item
          leftSection={<LuUser size={15} />}
          onClick={() => navigate({ to: '/profile' })}
        >
          Profile
        </Menu.Item>
        <Menu.Item
          leftSection={<LuSettings size={15} />}
          onClick={() => navigate({ to: '/subscription' })}
        >
          Subscription
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          leftSection={<LuLogOut size={15} />}
          onClick={onLogout}
          styles={{
            item: {
              color: 'var(--danger-text)',
              '&:hover': { backgroundColor: 'var(--danger-subtle)', color: 'var(--danger-text)' },
            },
          }}
        >
          Log out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
