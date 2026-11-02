import { useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Loader,
  ScrollArea,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { LuSearch, LuUsers } from 'react-icons/lu';
import { useAutoLoadMore } from '@features/recipes';
import { EmptyState } from '@components';
import { useAdminUsers, useUpdateAdminUser } from '../../hooks';
import type { PublicSubscriptionTier } from '@/types/schemas';

/** User registry: search, role editing, and plan changes. */
export function AdminUsersPage() {
  const usersQuery = useAdminUsers();
  const updateUser = useUpdateAdminUser();
  const [search, setSearch] = useState('');

  const users = usersQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const filtered = users.filter((user) =>
    `${user.display_name ?? ''} ${user.email ?? ''} ${user.id}`.toLowerCase().includes(search.toLowerCase()),
  );

  const isLoadMoreError = usersQuery.isFetchNextPageError;
  const loadMore = () => void usersQuery.fetchNextPage();

  const sentinelRef = useRef<HTMLDivElement>(null);
  useAutoLoadMore(sentinelRef, loadMore, usersQuery.hasNextPage && !usersQuery.isFetchingNextPage && !isLoadMoreError);

  if (usersQuery.isPending) {
    return (
      <Stack gap="lg">
        <Title order={1}>User registry</Title>
        {Array.from({ length: 10 }, (_, index) => (
          <Skeleton key={index} height={34} radius="sm" />
        ))}
      </Stack>
    );
  }

  if (usersQuery.isError) {
    return (
      <Stack gap="lg">
        <Title order={1}>User registry</Title>
        <Alert color="red" title="Could not load users">
          <Stack gap="sm">
            <Text size="sm">{usersQuery.error.message}</Text>
            <Button variant="light" color="red" maw="fit-content" onClick={() => void usersQuery.refetch()}>
              Retry
            </Button>
          </Stack>
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Title order={1}>User registry</Title>

      <TextInput
        placeholder="Search by name, email, or id…"
        leftSection={<LuSearch size={16} />}
        value={search}
        onChange={(event) => setSearch(event.currentTarget.value)}
        maw={420}
      />

      {users.length === 0 ? (
        <EmptyState
          icon={LuUsers}
          title="No users yet"
          description="Every cook who signs up appears here — roles and plans are editable per row."
        />
      ) : (
        <Card p={0}>
          <ScrollArea>
            <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>User</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Plan</Table.Th>
                  <Table.Th>Joined</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtered.map((user) => (
                  <Table.Tr key={user.id}>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text size="sm" fw={500}>
                          {user.display_name ?? 'Unnamed cook'}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {user.email ?? user.id.slice(0, 8)}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td w={150}>
                      <Select
                        value={user.role}
                        data={[
                          { value: 'user', label: 'User' },
                          { value: 'moderator', label: 'Moderator' },
                          { value: 'admin', label: 'Admin' },
                        ]}
                        onChange={(value) =>
                          value && updateUser.mutate({ userId: user.id, role: value as 'user' | 'moderator' | 'admin' })
                        }
                      />
                    </Table.Td>
                    <Table.Td w={130}>
                      <Select
                        value={user.subscription_tier}
                        data={[
                          { value: 'free', label: 'Free' },
                          { value: 'premium', label: 'Premium' },
                        ]}
                        onChange={(value) =>
                          value && updateUser.mutate({ userId: user.id, subscription_tier: value as PublicSubscriptionTier })
                        }
                      />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{new Date(user.created_at).toLocaleDateString()}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {filtered.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={4}>
                      <Text size="sm" c="dimmed" ta="center" py="md">
                        No users match “{search}” on the loaded pages — keep scrolling to load more.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : null}
              </Table.Tbody>
            </Table>
            {search.trim() !== '' ? (
              <Text size="xs" c="dimmed" ta="center" pb="xs">
                {filtered.length} of {users.length} loaded
              </Text>
            ) : null}
            <Stack ref={sentinelRef} gap="xs" align="center" py="md">
              {isLoadMoreError ? (
                <>
                  <Text size="sm" c="red">
                    Couldn&apos;t load more users.
                  </Text>
                  <Button variant="light" onClick={loadMore}>
                    Retry
                  </Button>
                </>
              ) : usersQuery.isFetchingNextPage ? (
                <Loader size="sm" />
              ) : !usersQuery.hasNextPage ? (
                <Text size="sm" c="dimmed">
                  End of the registry
                </Text>
              ) : null}
            </Stack>
          </ScrollArea>
        </Card>
      )}
    </Stack>
  );
}
