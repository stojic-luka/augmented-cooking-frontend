import { useEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Button,
  Card,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Markdown } from '@tanstack/markdown/react';
import {
  LuBot,
  LuChevronDown,
  LuCircleStop,
  LuPanelLeftClose,
  LuPanelLeftOpen,
  LuPencil,
  LuPlus,
  LuSend,
  LuTriangleAlert,
  LuTrash2,
} from 'react-icons/lu';
import { EmptyState } from '@components';
import { useAuthUser } from '@features/auth/providers/user';
import { ChatOptionsPopover } from './ChatOptionsPopover';
import { ChatTitleEditor } from './ChatTitleEditor';
import { ModelPickerModal } from './ModelPickerModal';
import {
  notifyChatError,
  useAiModels,
  useChatMessages,
  useChatSessions,
  useCreateChatSession,
  useDeleteChatSession,
  useRenameChatSession,
  useSendChatMessage,
  useSetChatModel,
} from '../hooks';
import { resolveChatModelId } from '../utils/modelAccess';
import { deriveChatTitle } from '../utils/chatTitle';
import { readStreamAnswerPreference, writeStreamAnswerPreference } from '../utils/streamPreference';
import type { ChatSession } from '../types';

const QUICK_PROMPTS = [
  'What can I cook with tomatoes, rice, and chicken?',
  'Give me a 20-minute vegetarian dinner idea.',
  'How do I substitute buttermilk in pancakes?',
  'Plan a high-protein day of meals for me.',
];

const SIDEBAR_WIDTH = 260;

/**
 * The AI chat surface. History is stored locally (Dexie); replies come from
 * the chat endpoint. Chats are named (at creation or renamed later) and carry
 * a per-chat model preference picked through the model picker.
 */
export function AiAssistantPage() {
  const { user, profile } = useAuthUser();
  const sessionsQuery = useChatSessions();
  const createSession = useCreateChatSession();
  const deleteSession = useDeleteChatSession();
  const renameChat = useRenameChatSession();
  const setChatModel = useSetChatModel();
  const modelsQuery = useAiModels(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const messagesQuery = useChatMessages(activeSessionId);
  const sendMessage = useSendChatMessage(activeSessionId);
  const [draft, setDraft] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [streamAnswer, setStreamAnswer] = useState(readStreamAnswerPreference);
  const [pickerOpened, { open: openPicker, close: closePicker }] = useDisclosure(false);

  const handleStreamAnswerChange = (next: boolean) => {
    setStreamAnswer(next);
    writeStreamAnswerPreference(next);
  };

  // One action, no dialog: the chat opens right away as "Untitled chat" and is
  // auto-titled from the first message (same rule as sending without a chat).
  const handleNewChat = () => {
    createSession.mutate(undefined, {
      onSuccess: (session) => {
        setRenamingId(null);
        setActiveSessionId(session.id);
      },
    });
  };

  const sessions = sessionsQuery.data ?? [];
  const messages = messagesQuery.data ?? [];
  const activeSession = activeSessionId ? (sessions.find((session) => session.id === activeSessionId) ?? null) : null;

  // Same resolution the send path uses, so the chip always shows the model
  // the next request will actually carry ("Default model" when none applies).
  const resolvedModel = resolveChatModelId({
    models: modelsQuery.data,
    storedModelId: activeSession?.modelId ?? null,
    profileModelId: profile?.ai_model_id ?? null,
    subscriptionTier: profile?.subscription_tier ?? 'free',
  });
  const activeModel = modelsQuery.data?.find((model) => model.id === resolvedModel.modelId) ?? null;

  // Keep the newest message in view whenever the list grows, the streaming
  // text extends, or the pending indicator appears.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, activeSessionId, sendMessage.isPending, sendMessage.streamedText]);

  const handleSend = (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    if (!activeSessionId) {
      createSession.mutate(deriveChatTitle(trimmed), {
        onSuccess: (session) => {
          setActiveSessionId(session.id);
          setDraft('');
          sendMessage.mutate(
            { content: trimmed, sessionId: session.id },
            {
              onError: (error) => notifyChatError(error),
            },
          );
        },
      });
      return;
    }

    sendMessage.mutate(
      { content: trimmed },
      {
        onError: (error) => notifyChatError(error),
      },
    );
    setDraft('');
  };

  return (
    <>
      {/* Fills the viewport between the app header and the page bottom:
          AppShell.Main's top padding = header offset + app padding, bottom = app padding. */}
      <Group
        align="stretch"
        wrap="nowrap"
        w="100%"
        style={{ height: 'calc(93dvh - var(--app-shell-header-offset, 60px) - var(--app-shell-padding, 1rem) * 2)' }}
      >
        {sidebarOpen ? (
          <Card p="sm" w={SIDEBAR_WIDTH} visibleFrom="sm" style={{ flexShrink: 0, height: '100%' }}>
            <Stack gap="xs" h="100%">
              <Group justify="space-between" wrap="nowrap">
                <Text fw={600} size="sm">
                  Conversations
                </Text>
                <Button size="compact-xs" variant="light" leftSection={<LuPlus size={12} />} onClick={handleNewChat}>
                  New
                </Button>
              </Group>
              {sessionsQuery.isPending ? (
                <Loader size="xs" />
              ) : sessions.length === 0 ? (
                <Text size="xs" c="dimmed">
                  No conversations yet.
                </Text>
              ) : (
                <ScrollArea style={{ flex: 1, minHeight: 0 }} type="auto">
                  <Stack gap={2}>
                    {sessions.map((session) => (
                      <SessionRow
                        key={session.id}
                        session={session}
                        active={session.id === activeSessionId}
                        // The row that was clicked edits in place — active or
                        // not. renamingId is cleared on switch/delete/commit so
                        // no editor ever surfaces in a background row.
                        isRenaming={renamingId === session.id}
                        onSelect={() => {
                          // Leaving this chat must not leave its stream
                          // running, nor a rename field open behind us.
                          sendMessage.abort();
                          setRenamingId(null);
                          setActiveSessionId(session.id);
                        }}
                        onStartRename={() => setRenamingId(session.id)}
                        onRenameCommit={(title) => {
                          setRenamingId(null);
                          renameChat.mutate({ sessionId: session.id, title });
                        }}
                        onRenameCancel={() => setRenamingId(null)}
                        onDelete={() =>
                          deleteSession.mutate(session.id, {
                            onSuccess: () => {
                              if (session.id === activeSessionId) {
                                sendMessage.abort();
                                setRenamingId(null);
                                setActiveSessionId(null);
                              }
                            },
                          })
                        }
                      />
                    ))}
                  </Stack>
                </ScrollArea>
              )}
            </Stack>
          </Card>
        ) : null}
        <Stack gap="md" flex={1} mih={0} h="100%" style={{ minWidth: 0 }}>
          <Group justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
              <Tooltip label={sidebarOpen ? 'Hide conversations' : 'Show conversations'} openDelay={300}>
                <ActionIcon
                  variant="subtle"
                  visibleFrom="sm"
                  aria-label="Toggle conversations sidebar"
                  onClick={() => setSidebarOpen((open) => !open)}
                >
                  {sidebarOpen ? <LuPanelLeftClose size={18} /> : <LuPanelLeftOpen size={18} />}
                </ActionIcon>
              </Tooltip>
              <ThemeIconWrap />
              <Group gap={4} wrap="nowrap">
                <Title order={2} style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  AI cooking assistant
                </Title>
              </Group>
            </Group>
            {activeSession ? (
              <Tooltip label="Change AI model" openDelay={300}>
                <Paper
                  component="button"
                  type="button"
                  withBorder
                  px="sm"
                  py={5}
                  radius="xl"
                  aria-label="Change AI model"
                  onClick={openPicker}
                >
                  <Group gap={4} wrap="nowrap">
                    <Text size="xs" c="dimmed">
                      {activeModel?.name ?? 'Default model'}
                    </Text>
                    <LuChevronDown size={12} style={{ color: 'var(--text-tertiary)' }} />
                  </Group>
                </Paper>
              </Tooltip>
            ) : null}
          </Group>
          <Paper withBorder p="md" radius={12} bg="var(--bg)" flex={1} mih={0}>
            {/* The message list is the only scrolling surface — the page itself never scrolls. */}
            <ScrollArea style={{ height: '100%' }} viewportRef={scrollRef}>
              {messages.length === 0 ? (
                <Stack gap="sm" align="center" justify="center" h="100%">
                  <EmptyState
                    icon={LuBot}
                    title={user ? 'Ask me anything about cooking' : 'Sign in to chat with your assistant'}
                    description="I can suggest recipes, adapt dishes to your diet, and explain techniques."
                  />
                  <Group gap="xs" justify="center" mt="sm" wrap="wrap">
                    {QUICK_PROMPTS.map((prompt) => (
                      <Button
                        key={prompt}
                        size="xs"
                        variant="light"
                        onClick={() => handleSend(prompt)}
                        disabled={sendMessage.isPending || createSession.isPending}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </Group>
                </Stack>
              ) : (
                <Stack gap="md">
                  {messages.map((message) => (
                    <Paper
                      key={message.id}
                      p="sm"
                      radius="md"
                      style={{
                        alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        background: message.role === 'user' ? 'var(--accent-subtle)' : 'var(--bg-subtle)',
                      }}
                    >
                      <Text size="xs" fw={500} c="dimmed" mb={4}>
                        {message.role === 'user' ? 'You' : 'Assistant'}
                      </Text>
                      {message.role === 'assistant' ? (
                        <>
                          <Markdown>{message.content}</Markdown>
                          {message.outcome ? (
                            <Group gap={4} mt={4}>
                              {message.outcome === 'stopped' ? (
                                <LuCircleStop size={12} style={{ color: 'var(--text-tertiary)' }} />
                              ) : (
                                <LuTriangleAlert size={12} style={{ color: 'var(--mantine-color-red-6)' }} />
                              )}
                              <Text size="xs" c={message.outcome === 'stopped' ? 'dimmed' : 'red'}>
                                {message.outcome === 'stopped' ? 'Stopped — partial answer' : 'Failed — partial answer'}
                              </Text>
                            </Group>
                          ) : null}
                        </>
                      ) : (
                        <Text size="sm">{message.content}</Text>
                      )}
                    </Paper>
                  ))}
                  {sendMessage.isPending ? (
                    <Paper p="sm" radius="md" bg="var(--bg-subtle)" style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                      {sendMessage.isStreaming &&
                      sendMessage.streamedSessionId === activeSessionId &&
                      sendMessage.streamedText.length > 0 ? (
                        <>
                          <Group gap={6} mb={4}>
                            <Text size="xs" fw={500} c="dimmed">
                              Assistant
                            </Text>
                            <Loader size={12} />
                          </Group>
                          <Markdown>{sendMessage.streamedText}</Markdown>
                        </>
                      ) : (
                        <Group gap={6}>
                          <Loader size={14} />
                          <Text size="sm" c="dimmed">
                            Assistant is thinking…
                          </Text>
                        </Group>
                      )}
                    </Paper>
                  ) : null}
                </Stack>
              )}
            </ScrollArea>
          </Paper>
          <Group wrap="nowrap" align="flex-end" w="100%">
            <ChatOptionsPopover streamAnswer={streamAnswer} onStreamAnswerChange={handleStreamAnswerChange} />
            <Textarea
              placeholder="Ask about recipes, substitutions, meal plans…"
              autosize
              minRows={1}
              maxRows={5}
              flex={1}
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend(draft);
                }
              }}
              disabled={sendMessage.isPending}
            />
            {sendMessage.isStreaming ? (
              <Tooltip label="Stop generating" openDelay={300}>
                <ActionIcon variant="light" color="red" aria-label="Stop generating" onClick={() => sendMessage.abort()}>
                  <LuCircleStop size={16} />
                </ActionIcon>
              </Tooltip>
            ) : null}
            {/* No explicit size/radius: theme defaults (28px, radius 7) keep it
                identical to the chat-options button on the other side, and the
                composer Group bottom-aligns both so they never ride up as the
                prompt grows. */}
            <ActionIcon
              variant="filled"
              aria-label="Send"
              mb={4}
              loading={sendMessage.isPending && !sendMessage.isStreaming}
              disabled={!draft.trim() || sendMessage.isStreaming}
              onClick={() => handleSend(draft)}
            >
              <LuSend size={16} />
            </ActionIcon>
          </Group>
        </Stack>
      </Group>
      <ModelPickerModal
        opened={pickerOpened}
        onClose={closePicker}
        models={modelsQuery.data}
        isLoading={modelsQuery.isPending}
        isError={modelsQuery.isError}
        onRetry={() => modelsQuery.refetch()}
        selectedModelId={resolvedModel.modelId}
        subscriptionTier={profile?.subscription_tier}
        onSelect={(modelId) => {
          if (!activeSessionId) return;
          setChatModel.mutate({ sessionId: activeSessionId, modelId });
          closePicker();
        }}
      />
    </>
  );
}

function SessionRow({
  session,
  active,
  isRenaming,
  onSelect,
  onStartRename,
  onRenameCommit,
  onRenameCancel,
  onDelete,
}: Readonly<{
  session: ChatSession;
  active: boolean;
  isRenaming: boolean;
  onSelect: () => void;
  onStartRename: () => void;
  onRenameCommit: (title: string) => void;
  onRenameCancel: () => void;
  onDelete: () => void;
}>) {
  return (
    <Group
      justify="space-between"
      wrap="nowrap"
      p={isRenaming ? 0 : 6}
      style={{
        borderRadius: 6,
        cursor: 'pointer',
        background: active ? 'var(--accent-subtle)' : 'transparent',
      }}
      onClick={onSelect}
    >
      {isRenaming ? (
        <ChatTitleEditor
          size="xs"
          initialTitle={session.title}
          style={{ flex: 1, minWidth: 0 }}
          onCommit={onRenameCommit}
          onCancel={onRenameCancel}
        />
      ) : (
        <Text size="sm" lineClamp={1} style={{ flex: 1 }}>
          {session.title}
        </Text>
      )}
      {isRenaming ? null : (
        <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
          <LuPencil
            size={13}
            aria-label="Rename conversation"
            role="button"
            style={{ color: 'var(--text-tertiary)' }}
            onClick={(event) => {
              event.stopPropagation();
              onStartRename();
            }}
          />
          <LuTrash2
            size={13}
            aria-label="Delete conversation"
            role="button"
            style={{ color: 'var(--text-tertiary)' }}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          />
        </Group>
      )}
    </Group>
  );
}

function ThemeIconWrap() {
  return <LuBot size={20} color="var(--accent)" aria-hidden />;
}
