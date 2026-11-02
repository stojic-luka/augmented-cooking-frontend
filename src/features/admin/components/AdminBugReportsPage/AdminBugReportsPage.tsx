import { useRef, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Divider,
  Grid,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Skeleton,
  Stack,
  Tabs,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { LuBug, LuInbox, LuRefreshCw } from 'react-icons/lu';
import { useAutoLoadMore } from '@features/recipes';
import { EmptyState } from '@components';
import { useBugReports, useResolveBugReport } from '../../hooks';

const SEVERITY_COLORS: Record<string, string> = { low: 'gray', medium: 'yellow', high: 'red' };
const PANE_HEIGHT = 560;

export function AdminBugReportsPage() {
  const reportsQuery = useBugReports();
  const resolve = useResolveBugReport();

  const [activeTab, setActiveTab] = useState<string>('open');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Tab counts and the selected-report lookup span ALL loaded pages.
  const reports = reportsQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const open = reports.filter((report) => report.status === 'open');
  const resolved = reports.filter((report) => report.status === 'resolved');
  const visible = activeTab === 'open' ? open : resolved;
  const selectedReport = reports.find((report) => report.id === selectedId) ?? null;

  const isLoadMoreError = reportsQuery.isFetchNextPageError;
  const loadMore = () => void reportsQuery.fetchNextPage();

  const sentinelRef = useRef<HTMLDivElement>(null);
  useAutoLoadMore(
    sentinelRef,
    loadMore,
    reportsQuery.hasNextPage && !reportsQuery.isFetchingNextPage && !isLoadMoreError,
  );

  if (reportsQuery.isPending) {
    return (
      <Stack gap="lg">
        <Title order={1}>Bug reports</Title>
        <Grid>
          <Grid.Col span={{ base: 12, sm: 5, md: 4 }}>
            <Skeleton height={PANE_HEIGHT} radius={12} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 7, md: 8 }}>
            <Skeleton height={PANE_HEIGHT} radius={12} />
          </Grid.Col>
        </Grid>
      </Stack>
    );
  }

  if (reportsQuery.isError) {
    return (
      <Stack gap="lg">
        <Title order={1}>Bug reports</Title>
        <Alert color="red" title="Could not load bug reports">
          <Stack gap="sm">
            <Text size="sm">{reportsQuery.error.message}</Text>
            <Button variant="light" color="red" maw="fit-content" onClick={() => void reportsQuery.refetch()}>
              Retry
            </Button>
          </Stack>
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4}>
          <Title order={1}>Bug reports</Title>
          <Text size="sm" c="dimmed">
            {open.length} open · {resolved.length} resolved
          </Text>
        </Stack>
        <ActionIcon variant="default" size="lg" loading={reportsQuery.isFetching} onClick={() => void reportsQuery.refetch()}>
          <LuRefreshCw size={16} />
        </ActionIcon>
      </Group>

      {reports.length === 0 ? (
        <EmptyState icon={LuBug} title="No bug reports" description="Bug reports from the support page appear here." />
      ) : (
        <>
          <Tabs value={activeTab} onChange={(value) => setActiveTab(value ?? 'open')}>
            <Tabs.List>
              <Tabs.Tab
                value="open"
                rightSection={
                  <Badge size="xs" variant="light" color={open.length > 0 ? 'red' : 'gray'} circle>
                    {open.length}
                  </Badge>
                }
              >
                Open
              </Tabs.Tab>
              <Tabs.Tab
                value="resolved"
                rightSection={
                  <Badge size="xs" variant="light" color="gray" circle>
                    {resolved.length}
                  </Badge>
                }
              >
                Resolved
              </Tabs.Tab>
            </Tabs.List>
          </Tabs>

          <Grid>
            {/* inbox list */}
            <Grid.Col span={{ base: 12, sm: 5, md: 4 }}>
              <Paper withBorder radius={12} h="100%">
                <ScrollArea h={PANE_HEIGHT}>
                  <Stack gap={4} p="xs">
                    {visible.length === 0 ? (
                      <Text size="sm" c="dimmed" ta="center" py="xl">
                        {activeTab === 'open' ? 'Nothing open — nice.' : 'No resolved reports yet.'}
                      </Text>
                    ) : (
                      visible.map((report) => {
                        const isSelected = report.id === selectedId;
                        return (
                          <UnstyledButton
                            key={report.id}
                            onClick={() => setSelectedId(report.id)}
                            w="100%"
                            p="xs"
                            bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}
                            styles={{
                              root: {
                                '&:hover': {
                                  backgroundColor: isSelected
                                    ? 'var(--mantine-color-blue-light)'
                                    : 'var(--mantine-color-default-hover)',
                                },
                              },
                            }}
                          >
                            <Stack gap={4}>
                              <Group justify="space-between" wrap="nowrap" gap="xs">
                                <Text size="sm" fw={600} truncate="end" style={{ flex: 1, minWidth: 0 }}>
                                  {report.subject}
                                </Text>
                                <Badge size="xs" variant="light" color={SEVERITY_COLORS[report.severity] ?? 'gray'}>
                                  {report.severity}
                                </Badge>
                              </Group>
                              <Text size="xs" c="dimmed" lineClamp={2}>
                                {report.description}
                              </Text>
                              <Group justify="space-between" wrap="nowrap" gap="xs">
                                <Text size="xs" c="dimmed" truncate="end" style={{ flex: 1, minWidth: 0 }}>
                                  {report.user_id ? `user ${report.user_id.slice(0, 8)}` : 'anonymous'}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {new Date(report.created_at).toLocaleDateString()}
                                </Text>
                              </Group>
                            </Stack>
                          </UnstyledButton>
                        );
                      })
                    )}
                    <Stack ref={sentinelRef} gap="xs" align="center" py="md">
                      {isLoadMoreError ? (
                        <>
                          <Text size="sm" c="red">
                            Couldn&apos;t load more reports.
                          </Text>
                          <Button variant="light" onClick={loadMore}>
                            Retry
                          </Button>
                        </>
                      ) : reportsQuery.isFetchingNextPage ? (
                        <Loader size="sm" />
                      ) : !reportsQuery.hasNextPage ? (
                        <Text size="sm" c="dimmed">
                          End of the inbox
                        </Text>
                      ) : null}
                    </Stack>
                  </Stack>
                </ScrollArea>
              </Paper>
            </Grid.Col>

            {/* reading pane */}
            <Grid.Col span={{ base: 12, sm: 7, md: 8 }}>
              <Paper withBorder radius={12} h="100%">
                {selectedReport == null ? (
                  <Stack h={PANE_HEIGHT} align="center" justify="center">
                    <EmptyState
                      icon={LuInbox}
                      title="No report selected"
                      description="Pick a report from the list to read the full description."
                    />
                  </Stack>
                ) : (
                  <ScrollArea h={PANE_HEIGHT}>
                    <Stack p="md" gap="sm">
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Title order={3}>{selectedReport.subject}</Title>
                        <Badge size="sm" variant="light" color={SEVERITY_COLORS[selectedReport.severity] ?? 'gray'}>
                          {selectedReport.severity}
                        </Badge>
                      </Group>

                      <Group gap="xs" wrap="wrap">
                        <Badge size="sm" variant="light" color={selectedReport.status === 'open' ? 'blue' : 'green'}>
                          {selectedReport.status}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          {new Date(selectedReport.created_at).toLocaleString()}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {selectedReport.user_id ? `user ${selectedReport.user_id.slice(0, 8)}` : 'anonymous'}
                        </Text>
                      </Group>

                      <Divider />

                      <Text size="sm" lh={1.6} style={{ whiteSpace: 'pre-wrap' }}>
                        {selectedReport.description}
                      </Text>

                      <Group justify="flex-end">
                        {selectedReport.status === 'open' ? (
                          <Button
                            variant="light"
                            color="green"
                            loading={resolve.isPending && resolve.variables === selectedReport.id}
                            onClick={() => resolve.mutate(selectedReport.id)}
                          >
                            Resolve
                          </Button>
                        ) : (
                          <Badge color="green" variant="light">
                            Resolved
                          </Badge>
                        )}
                      </Group>
                    </Stack>
                  </ScrollArea>
                )}
              </Paper>
            </Grid.Col>
          </Grid>
        </>
      )}
    </Stack>
  );
}
