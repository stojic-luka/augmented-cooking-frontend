import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useForm, schemaResolver } from '@mantine/form';
import { useNavigate } from '@tanstack/react-router';
import { notifications } from '@mantine/notifications';
import { LuLifeBuoy, LuPanelLeftClose, LuPanelLeftOpen, LuMessageCircle, LuSend, LuWrench } from 'react-icons/lu';
import { EmptyState } from '@components';
import { useAuthUser } from '@features/auth/providers/user';
import { newTicketFormSchema, type NewTicketFormValues } from '../types';
import { useCreateBugReport, useCreateTicket, useMyTickets, useSendTicketMessage, useTicketMessages } from '../hooks';
import type { PublicSupportTicketsRow, PublicTicketCategory } from '@/types/schemas';

const STATUS_BADGES: Record<string, { color: string; label: string }> = {
  open: { color: 'brand', label: 'Open' },
  in_progress: { color: 'yellow', label: 'In progress' },
  resolved: { color: 'green', label: 'Resolved' },
};

const CATEGORY_LABELS: Record<PublicTicketCategory, string> = {
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

const FAQS = [
  'How do I export my meal plan?',
  'AI conversion seems inaccurate — what can I do?',
  'Managing tokens & subscription',
  'How do unit conversions work in cook mode?',
];

type ComposeMode = 'ticket' | 'bug';

export function SupportPage() {
  const { user, isAuthed } = useAuthUser();
  const navigate = useNavigate();

  const ticketsQuery = useMyTickets(user?.id ?? null);
  const createTicket = useCreateTicket(user?.id ?? null);
  const bugReport = useCreateBugReport(user?.id ?? null);
  const sendMessage = useSendTicketMessage(user?.id ?? null);

  const [tab, setTab] = useState('new');
  const [mode, setMode] = useState<ComposeMode>('ticket');
  const [listCollapsed, setListCollapsed] = useState(false);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const messagesQuery = useTicketMessages(activeTicketId);

  const form = useForm<NewTicketFormValues>({
    initialValues: { subject: '', category: 'bug', severity: 'medium', description: '' },
    validate: schemaResolver(newTicketFormSchema),
  });

  const tickets = ticketsQuery.data ?? [];
  const activeTicket = tickets.find((ticket) => ticket.id === activeTicketId) ?? null;
  const openTicketCount = tickets.filter((ticket) => ticket.status !== 'resolved').length;

  // Drop the selection if the ticket vanishes from the list (closed/deleted elsewhere)…
  useEffect(() => {
    if (ticketsQuery.data && activeTicketId && !activeTicket) {
      setActiveTicketId(null);
    }
  }, [ticketsQuery.data, activeTicketId, activeTicket]);

  // …and fall back to the first ticket so the panel is never uselessly empty.
  useEffect(() => {
    if (ticketsQuery.data && !activeTicketId && tickets.length > 0) {
      setActiveTicketId(tickets[0].id);
    }
  }, [ticketsQuery.data, activeTicketId, tickets.length]);

  // Don't carry a half-written reply from one conversation into another.
  useEffect(() => {
    setReply('');
  }, [activeTicketId]);

  const goToLogin = () => navigate({ to: '/login', search: { next: '/support' } });

  // One submit path for both modes — form.onSubmit runs the same schema either way.
  const handleSubmit = (values: NewTicketFormValues) => {
    if (mode === 'bug') {
      bugReport.mutate(
        { title: values.subject, description: values.description, severity: values.severity },
        {
          onSuccess: () => {
            form.reset();
            notifications.show({ title: 'Bug report submitted', message: 'Thanks for helping us improve!', color: 'green' });
          },
          onError: (error) => notifications.show({ title: 'Could not submit', message: error.message, color: 'red' }),
        },
      );
      return;
    }

    createTicket.mutate(values, {
      onSuccess: () => {
        form.reset();
        notifications.show({ title: 'Ticket submitted', message: 'Our team will get back to you soon.', color: 'green' });
        setTab('tickets');
      },
      onError: (error) => notifications.show({ title: 'Could not submit', message: error.message, color: 'red' }),
    });
  };

  const handleSendReply = () => {
    if (!activeTicketId || !reply.trim() || sendMessage.isPending) return;
    sendMessage.mutate(
      { ticketId: activeTicketId, body: reply },
      {
        onSuccess: () => setReply(''),
        onError: (error) => notifications.show({ title: 'Message not sent', message: error.message, color: 'red' }),
      },
    );
  };

  return (
    <Stack gap="xl">
      <Title order={1}>Support & help desk</Title>

      <Tabs value={tab} onChange={(value) => setTab(value ?? 'new')}>
        <Tabs.List>
          <Tabs.Tab value="new" leftSection={<LuWrench size={16} />}>
            New request
          </Tabs.Tab>
          <Tabs.Tab
            value="tickets"
            leftSection={<LuLifeBuoy size={16} />}
            rightSection={
              openTicketCount > 0 ? (
                <Badge color="brand" size="xs" circle>
                  {openTicketCount}
                </Badge>
              ) : null
            }
          >
            My tickets
          </Tabs.Tab>
        </Tabs.List>

        {/* ---------- New request: full-width form with mode switcher ---------- */}
        <Tabs.Panel value="new" pt="lg">
          <Stack gap="lg">
            <Card>
              <SegmentedControl
                value={mode}
                onChange={(value) => setMode(value === 'bug' ? 'bug' : 'ticket')}
                data={[
                  { value: 'ticket', label: 'Support ticket' },
                  { value: 'bug', label: 'Bug report' },
                ]}
                mb="md"
                w="fit-content"
              />

              <form onSubmit={form.onSubmit(handleSubmit)}>
                <Stack gap="sm">
                  <Group align="flex-start" wrap="wrap" gap="sm">
                    <TextInput
                      label="Subject"
                      placeholder="Brief summary of the issue"
                      style={{ flex: '1 1 280px' }}
                      key={form.key('subject')}
                      {...form.getInputProps('subject')}
                    />
                    {mode === 'ticket' ? (
                      <Select
                        label="Category"
                        w={200}
                        data={[
                          { value: 'bug', label: 'Technical bug' },
                          { value: 'recipe', label: 'Recipe / AI issue' },
                          { value: 'billing', label: 'Billing & subscription' },
                          { value: 'feature', label: 'Feature request' },
                        ]}
                        key={form.key('category')}
                        {...form.getInputProps('category')}
                      />
                    ) : null}
                    <Select
                      label="Severity"
                      w={200}
                      data={[
                        { value: 'low', label: 'Low' },
                        { value: 'medium', label: 'Medium' },
                        { value: 'high', label: 'High — something is broken' },
                      ]}
                      key={form.key('severity')}
                      {...form.getInputProps('severity')}
                    />
                  </Group>

                  <Textarea
                    label="Description"
                    placeholder="What happened, what did you expect, and what did you try?"
                    minRows={5}
                    key={form.key('description')}
                    {...form.getInputProps('description')}
                  />

                  <Text size="xs" c="dimmed">
                    {mode === 'ticket'
                      ? 'Tickets are answered by support — track the conversation under “My tickets”.'
                      : 'Bug reports skip the queue and land directly in the engineering backlog (no reply thread).'}
                  </Text>

                  <Group justify="flex-end">
                    <Button
                      type="submit"
                      loading={mode === 'ticket' ? createTicket.isPending : bugReport.isPending}
                      disabled={!isAuthed}
                    >
                      {mode === 'ticket' ? 'Open ticket' : 'Submit bug report'}
                    </Button>
                  </Group>

                  {!isAuthed ? (
                    <Text size="xs" c="dimmed">
                      <Anchor size="xs" onClick={goToLogin} style={{ cursor: 'pointer' }}>
                        Sign in
                      </Anchor>{' '}
                      to open tickets and track their status.
                    </Text>
                  ) : null}
                </Stack>
              </form>
            </Card>

            <Card bg="var(--bg-subtle)">
              <Group gap="sm" mb="sm">
                <LuWrench size={18} />
                <Text fw={600}>Frequently asked questions</Text>
              </Group>
              <Stack gap={4}>
                {FAQS.map((faq) => (
                  <Text key={faq} size="sm" c="dimmed">
                    • {faq} — full answers ship with the help-center content in the admin panel.
                  </Text>
                ))}
              </Stack>
            </Card>
          </Stack>
        </Tabs.Panel>

        {/* ---------- My tickets: compact collapsible list + conversation ---------- */}
        <Tabs.Panel value="tickets" pt="lg">
          {!isAuthed ? (
            <Stack align="center" gap="sm">
              <EmptyState
                icon={LuLifeBuoy}
                title="Sign in to view your tickets"
                description="Your conversations with support and their status live here."
              />
              <Button variant="light" onClick={goToLogin}>
                Go to sign in
              </Button>
            </Stack>
          ) : ticketsQuery.isPending ? (
            <Text size="sm" c="dimmed">
              Loading tickets…
            </Text>
          ) : ticketsQuery.isError ? (
            <Text size="sm" c="red">
              {ticketsQuery.error.message}
            </Text>
          ) : tickets.length === 0 ? (
            <EmptyState
              icon={LuLifeBuoy}
              title="No tickets yet"
              description="When you contact support, your tickets and their status appear here."
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
                  {openTicketCount > 0 ? (
                    <Tooltip label={`${openTicketCount} open`} position="right">
                      <Badge color="brand" size="xs" circle>
                        {openTicketCount}
                      </Badge>
                    </Tooltip>
                  ) : null}
                </Stack>
              ) : (
                <Stack gap={6} w={{ base: '100%', md: 300 }} style={{ flexShrink: 0 }}>
                  <Group justify="space-between" wrap="nowrap" px={4}>
                    <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                      {openTicketCount} open
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
                        <TicketRow
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

              {/* Conversation — same column as before, whether the rail is open or slim. */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {activeTicket ? (
                  <TicketConversation
                    key={activeTicket.id}
                    ticket={activeTicket}
                    query={messagesQuery}
                    reply={reply}
                    onReplyChange={setReply}
                    onSend={handleSendReply}
                    sending={sendMessage.isPending}
                  />
                ) : (
                  <Paper withBorder p="xl" radius={12} mih={280}>
                    <Stack align="center" justify="center" mih={240} gap="xs">
                      <LuMessageCircle size={21} style={{ color: 'var(--text-tertiary)' }} />
                      <Text size="sm" c="dimmed">
                        Select a ticket to view the conversation.
                      </Text>
                    </Stack>
                  </Paper>
                )}
              </div>
            </Group>
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function TicketConversation({
  ticket,
  query,
  reply,
  onReplyChange,
  onSend,
  sending,
}: Readonly<{
  ticket: PublicSupportTicketsRow;
  query: ReturnType<typeof useTicketMessages>;
  reply: string;
  onReplyChange: (next: string) => void;
  onSend: () => void;
  sending: boolean;
}>) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const messageCount = query.data?.length ?? 0;

  const isTrimmed = ticket.subject !== ticket.subject.trim();

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

  const badge = STATUS_BADGES[ticket.status] ?? STATUS_BADGES.open;

  return (
    <Paper withBorder p="md" radius={12}>
      <Stack gap="sm">
        <div>
          <Group justify="space-between" wrap="nowrap" gap="sm">
            <Tooltip label={ticket.subject} disabled={!isTrimmed} openDelay={250} withinPortal>
              <Text fw={600} lineClamp={1} style={{ minWidth: 0 }}>
                {ticket.subject}
              </Text>
            </Tooltip>
            <Badge size="xs" color={badge.color} variant="light" style={{ flexShrink: 0 }}>
              {badge.label}
            </Badge>
          </Group>
          <Text size="xs" c="dimmed" mt={3}>
            {CATEGORY_LABELS[ticket.category] ?? ticket.category} · {SEVERITY_LABELS[ticket.severity] ?? ticket.severity}{' '}
            severity · updated {new Date(ticket.updated_at).toLocaleString()}
          </Text>
        </div>

        <ScrollArea h={380} viewportRef={viewportRef}>
          <Stack gap="sm" pr="sm">
            {query.isPending ? (
              <Text size="sm" c="dimmed">
                Loading messages…
              </Text>
            ) : query.isError ? (
              <Text size="sm" c="red">
                {query.error.message}
              </Text>
            ) : messageCount === 0 ? (
              <Text size="sm" c="dimmed">
                No messages yet.
              </Text>
            ) : (
              (query.data ?? []).map((message) => (
                <Paper
                  key={message.id}
                  p="sm"
                  radius="md"
                  bg={message.sender_role === 'user' ? 'var(--accent-subtle)' : 'var(--surface-hover)'}
                  style={{
                    alignSelf: message.sender_role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                  }}
                >
                  <Text size="sm">{message.body}</Text>
                  <Text size="xs" c="dimmed" mt={4}>
                    {message.sender_role === 'user' ? 'You' : 'Support'} · {new Date(message.created_at).toLocaleString()}
                  </Text>
                </Paper>
              ))
            )}
          </Stack>
        </ScrollArea>

        <Group wrap="nowrap" align="flex-end">
          <Textarea
            placeholder="Write a reply… (Enter to send, Shift+Enter for a new line)"
            autosize
            minRows={1}
            maxRows={4}
            flex={1}
            value={reply}
            onChange={(event) => onReplyChange(event.currentTarget.value)}
            onKeyDown={handleKeyDown}
          />
          <Button leftSection={<LuSend size={14} />} loading={sending} disabled={!reply.trim()} onClick={onSend}>
            Send
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

// module level, next to STATUS_BADGES
const SUBJECT_MAX_CHARS = 26; // tuned for the 280px rail + status badge

function truncateSubject(subject: string, maxChars = SUBJECT_MAX_CHARS): string {
  if (subject.length <= maxChars) return subject;
  return `${subject.slice(0, maxChars - 1).trimEnd()}…`;
}

function TicketRow({
  ticket,
  active,
  onSelect,
}: Readonly<{ ticket: PublicSupportTicketsRow; active: boolean; onSelect: () => void }>) {
  const badge = STATUS_BADGES[ticket.status] ?? STATUS_BADGES.open;
  const isTrimmed = ticket.subject.length > SUBJECT_MAX_CHARS;

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
          <Text size="sm" fw={500} truncate style={{ minWidth: 0, flex: 1 }}>
            {truncateSubject(ticket.subject)}
          </Text>
        </Tooltip>
        <Badge size="xs" color={badge.color} variant="light">
          {badge.label}
        </Badge>
      </Group>
      <Text size="xs" c="dimmed" mt={3}>
        {CATEGORY_LABELS[ticket.category] ?? ticket.category} · {new Date(ticket.updated_at).toLocaleDateString()}
      </Text>
    </Paper>
  );
}
