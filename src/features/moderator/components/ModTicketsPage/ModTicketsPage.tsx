import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Container,
  Group,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  Textarea,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { LuMessageCircle, LuPanelLeftClose, LuPanelLeftOpen, LuSend, LuTicket } from 'react-icons/lu';
import { EmptyState } from '@components';
import { useAuthUser } from '@features/auth/providers/user';
import { useReplyToTicket, useSetTicketStatus, useTicketQueue, useTicketThread } from '../../hooks';

// Derived from the hooks themselves, so no extra schema imports are needed.
type QueueTicket = NonNullable<ReturnType<typeof useTicketQueue>['data']>[number];
type ThreadQuery = ReturnType<typeof useTicketThread>;

const STATUS_BADGES: Record<string, { color: string; label: string }> = {
  open: { color: 'brand', label: 'Open' },
  in_progress: { color: 'yellow', label: 'In progress' },
  resolved: { color: 'green', label: 'Resolved' },
};

const CATEGORY_LABELS: Record<string, string> = {
  bug: 'Technical bug',
  recipe: 'Recipe / AI issue',
  billing: 'Billing & subscription',
  feature: 'Feature request',
};

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const SUBJECT_MAX_CHARS = 28; // tuned for the 300px rail + status badge

function truncateSubject(subject: string, maxChars = SUBJECT_MAX_CHARS): string {
  if (subject.length <= maxChars) return subject;
  return `${subject.slice(0, maxChars - 1).trimEnd()}…`;
}

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
];

const FILTER_OPTIONS = [
  { value: 'open', label: 'Unresolved' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
];

/** Moderator support-ticket triage page: queue list plus conversation thread. */
export function ModTicketsPage() {
  const { user } = useAuthUser();
  const ticketsQuery = useTicketQueue();
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const threadQuery = useTicketThread(activeTicketId);
  const reply = useReplyToTicket(user?.id ?? null);
  const setStatus = useSetTicketStatus();
  const [draft, setDraft] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [listCollapsed, setListCollapsed] = useState(false);

  const allTickets = ticketsQuery.data ?? [];
  const unresolvedCount = allTickets.filter((ticket) => ticket.status !== 'resolved').length;
  const tickets = allTickets.filter((ticket) =>
    statusFilter === 'all' ? true : statusFilter === 'open' ? ticket.status !== 'resolved' : ticket.status === statusFilter,
  );
  const activeTicket =
    tickets.find((ticket) => ticket.id === activeTicketId) ??
    allTickets.find((ticket) => ticket.id === activeTicketId) ??
    null;

  // Drop the selection if the ticket disappears from the queue entirely…
  useEffect(() => {
    if (ticketsQuery.data && activeTicketId && !allTickets.some((ticket) => ticket.id === activeTicketId)) {
      setActiveTicketId(null);
    }
  }, [ticketsQuery.data, activeTicketId, allTickets]);

  // …and fall back to the first ticket in the current filter so the panel is never empty.
  useEffect(() => {
    if (!activeTicketId && tickets.length > 0) {
      setActiveTicketId(tickets[0].id);
    }
  }, [activeTicketId, tickets]);

  // Don't carry a half-written reply from one conversation into another.
  useEffect(() => {
    setDraft('');
  }, [activeTicketId]);

  const handleSendReply = () => {
    if (!activeTicketId || !draft.trim() || reply.isPending) return;
    reply.mutate(
      { ticketId: activeTicketId, body: draft },
      {
        onSuccess: () => setDraft(''),
        onError: (error) => notifications.show({ title: 'Message not sent', message: error.message, color: 'red' }),
      },
    );
  };

  const handleStatusChange = (ticketId: string, status: string) => {
    setStatus.mutate(
      { ticketId, status: status as 'open' | 'in_progress' | 'resolved' },
      {
        onError: (error) => notifications.show({ title: 'Could not update status', message: error.message, color: 'red' }),
      },
    );
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={1}>Support tickets</Title>
          <Select
            value={statusFilter}
            onChange={(value) => setStatusFilter(value ?? 'open')}
            data={FILTER_OPTIONS}
            allowDeselect={false}
            w={180}
          />
        </Group>

        {ticketsQuery.isPending ? (
          <Text size="sm" c="dimmed">
            Loading queue…
          </Text>
        ) : ticketsQuery.isError ? (
          <Text size="sm" c="red">
            {ticketsQuery.error.message}
          </Text>
        ) : tickets.length === 0 ? (
          <EmptyState
            icon={LuTicket}
            title="Queue is clear"
            description="No tickets match this filter. User submissions appear here for triage."
          />
        ) : (
          <Group align="flex-start" gap="sm">
            {/* Left rail — always present. 300px when open, slim strip when collapsed. */}
            {listCollapsed ? (
              <Stack align="center" gap={8} w={{ base: '100%', md: 36 }} style={{ flexShrink: 0 }}>
                <Tooltip label="Show ticket list" position="right">
                  <ActionIcon
                    variant="default"
                    size="lg"
                    radius="md"
                    aria-label="Show ticket list"
                    onClick={() => setListCollapsed(false)}
                  >
                    <LuPanelLeftOpen size={16} />
                  </ActionIcon>
                </Tooltip>
                {unresolvedCount > 0 ? (
                  <Tooltip label={`${unresolvedCount} unresolved`} position="right">
                    <Badge color="brand" size="xs" circle>
                      {unresolvedCount}
                    </Badge>
                  </Tooltip>
                ) : null}
              </Stack>
            ) : (
              <Stack gap={6} w={{ base: '100%', md: 300 }} style={{ flexShrink: 0 }}>
                <Group justify="space-between" wrap="nowrap" px={4}>
                  <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                    {unresolvedCount} unresolved
                  </Text>
                  <Tooltip label="Hide ticket list">
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      aria-label="Hide ticket list"
                      onClick={() => setListCollapsed(true)}
                    >
                      <LuPanelLeftClose size={15} />
                    </ActionIcon>
                  </Tooltip>
                </Group>

                <ScrollArea.Autosize mah={440} scrollbars="y">
                  <Stack gap={6}>
                    {tickets.map((ticket) => (
                      <ModTicketRow
                        key={ticket.id}
                        ticket={ticket}
                        active={ticket.id === activeTicketId}
                        onSelect={() => setActiveTicketId(ticket.id)}
                      />
                    ))}
                  </Stack>
                </ScrollArea.Autosize>
              </Stack>
            )}

            {/* Conversation — same column whether the rail is open or slim. */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {activeTicket ? (
                <ModTicketConversation
                  key={activeTicket.id}
                  ticket={activeTicket}
                  query={threadQuery}
                  draft={draft}
                  onDraftChange={setDraft}
                  onSend={handleSendReply}
                  sending={reply.isPending}
                  onStatusChange={handleStatusChange}
                  statusChanging={setStatus.isPending}
                />
              ) : (
                <Paper withBorder p="xl" radius={12} mih={320}>
                  <Stack align="center" justify="center" mih={280} gap="xs">
                    <LuMessageCircle size={21} style={{ color: 'var(--text-tertiary)' }} />
                    <Text size="sm" c="dimmed">
                      Select a ticket to join the conversation.
                    </Text>
                  </Stack>
                </Paper>
              )}
            </div>
          </Group>
        )}
      </Stack>
    </Container>
  );
}

function ModTicketConversation({
  ticket,
  query,
  draft,
  onDraftChange,
  onSend,
  sending,
  onStatusChange,
  statusChanging,
}: Readonly<{
  ticket: QueueTicket;
  query: ThreadQuery;
  draft: string;
  onDraftChange: (next: string) => void;
  onSend: () => void;
  sending: boolean;
  onStatusChange: (ticketId: string, status: string) => void;
  statusChanging: boolean;
}>) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const messageCount = query.data?.length ?? 0;

  // Keep the newest message in view whenever the thread loads or grows.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollTo({ top: viewport.scrollHeight });
  }, [messageCount]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSend();
    }
  };

  const requester = ticket.requester_display_name ?? ticket.user_id.slice(0, 8);

  return (
    <Paper withBorder p="md" radius={12}>
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
          <div style={{ minWidth: 0 }}>
            <Text fw={600} truncate>
              {ticket.subject}
            </Text>
            <Text size="xs" c="dimmed" mt={3}>
              {CATEGORY_LABELS[ticket.category] ?? ticket.category} · {SEVERITY_LABELS[ticket.severity] ?? ticket.severity}{' '}
              severity · {requester}
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              {ticket.description}
            </Text>
          </div>
          <Select
            value={ticket.status}
            onChange={(value) => value && onStatusChange(ticket.id, value)}
            data={STATUS_OPTIONS}
            allowDeselect={false}
            w={150}
            aria-label="Ticket status"
            loading={statusChanging}
          />
        </Group>

        <ScrollArea h={380} viewportRef={viewportRef}>
          <Stack gap="sm" pr="sm">
            {query.isPending ? (
              <Text size="xs" c="dimmed">
                Loading conversation…
              </Text>
            ) : query.isError ? (
              <Text size="xs" c="red">
                {query.error.message}
              </Text>
            ) : messageCount === 0 ? (
              <Text size="xs" c="dimmed">
                No messages in this thread yet.
              </Text>
            ) : (
              (query.data ?? []).map((message) => (
                <Paper
                  key={message.id}
                  p="sm"
                  radius="md"
                  bg={message.sender_role === 'user' ? 'var(--surface-hover)' : 'var(--warning-subtle)'}
                  style={{
                    alignSelf: message.sender_role === 'user' ? 'flex-start' : 'flex-end',
                    maxWidth: '85%',
                  }}
                >
                  <Text size="sm">{message.body}</Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    {message.sender_role === 'user' ? 'User' : 'Support'} · {new Date(message.created_at).toLocaleString()}
                  </Text>
                </Paper>
              ))
            )}
          </Stack>
        </ScrollArea>

        <Group wrap="nowrap" align="flex-end">
          <Textarea
            placeholder="Reply to the user… (Enter to send, Shift+Enter for a new line)"
            autosize
            minRows={1}
            maxRows={4}
            flex={1}
            value={draft}
            onChange={(event) => onDraftChange(event.currentTarget.value)}
            onKeyDown={handleKeyDown}
          />
          <Button leftSection={<LuSend size={14} />} loading={sending} disabled={!draft.trim()} onClick={onSend}>
            Send
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

function ModTicketRow({
  ticket,
  active,
  onSelect,
}: Readonly<{ ticket: QueueTicket; active: boolean; onSelect: () => void }>) {
  const badge = STATUS_BADGES[ticket.status] ?? STATUS_BADGES.open;
  const isTrimmed = ticket.subject.length > SUBJECT_MAX_CHARS;
  const requester = ticket.requester_display_name ?? ticket.user_id.slice(0, 8);

  return (
    <Paper
      withBorder
      p="xs"
      radius={10}
      style={{ cursor: 'pointer', background: active ? 'var(--accent-subtle)' : undefined }}
      onClick={onSelect}
    >
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Tooltip label={ticket.subject} disabled={!isTrimmed} openDelay={250}>
          <Text size="sm" fw={active ? 600 : 500} truncate style={{ minWidth: 0, flex: 1 }}>
            {truncateSubject(ticket.subject)}
          </Text>
        </Tooltip>
        <Badge size="xs" color={badge.color} variant="light">
          {badge.label}
        </Badge>
      </Group>
      <Text size="xs" c="dimmed" mt={3}>
        {CATEGORY_LABELS[ticket.category] ?? ticket.category} · {requester}
      </Text>
    </Paper>
  );
}
