import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiAssistantPage } from './AiAssistantPage';
import { chatDb } from '../lib/chatDb';
import { deriveChatTitle } from '../utils/chatTitle';
import { IDS, profile } from '@/test/fixtures/db';
import { seed } from '@/test/fixtures/tables';
import { seedSession } from '@/test/auth';
import { renderRoutes } from '@/test/utils';
import { server } from '@/test/server';
import { API_URL, sseStreamResponse } from '@/test/handlers/rest';

/**
 * The chat flow: the user message is stored locally, sent to the chat endpoint
 * (full answer or stream), and the reply is rendered next to it. Backend
 * failures surface as a notification while the local history stays intact.
 * New chats open immediately as "Untitled chat", are auto-titled from the
 * first message, can be renamed in place, and carry a per-chat model
 * preference selected through the header chip's picker.
 */
function renderAssistant() {
  return renderRoutes([{ path: '/ai-assistant', component: () => <AiAssistantPage /> }], '/ai-assistant');
}

async function createChat(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'New' }, { timeout: 10000 }));
  // The chat opens immediately; the model chip only renders for an active chat.
  await screen.findByRole('button', { name: 'Change AI model' }, { timeout: 10000 });
}

describe('AiAssistantPage', () => {
  beforeEach(async () => {
    seedSession();
    await Promise.all([chatDb.sessions.clear(), chatDb.messages.clear()]);
  });

  it('creates a session, sends the message, and renders the reply', { timeout: 15000 }, async () => {
    const user = userEvent.setup();
    // Full-answer mode: this test pins the non-streaming transport.
    localStorage.setItem('ai-chat:stream', 'false');
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API_URL}/ai/chat`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ reply: 'Try simmering longer.', tokensUsed: 42 });
      }),
    );

    renderAssistant();

    await createChat(user);
    await user.type(
      await screen.findByPlaceholderText('Ask about recipes, substitutions, meal plans…'),
      'How long do I simmer rice?',
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));

    // The text also lands in the sidebar row and the auto-titled header —
    // at least the transcript bubble must render.
    expect(
      (await screen.findAllByText('How long do I simmer rice?', {}, { timeout: 10000 })).length,
    ).toBeGreaterThan(0);
    // The streaming preview bubble swaps to the persisted bubble — assert on
    // the live DOM, not a node reference that the swap can detach.
    await waitFor(() => expect(screen.getByText('Try simmering longer.')).toBeInTheDocument(), { timeout: 10000 });

    expect(typeof body?.sessionId).toBe('string');
    expect(body?.messages).toEqual([{ role: 'user', content: 'How long do I simmer rice?' }]);

    // Both turns are persisted locally in Dexie, tokens included. The table is
    // keyed by random UUIDs — sort by createdAt to get creation order.
    const messages = (await chatDb.messages.toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    expect(messages.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(messages[1].tokensUsed).toBe(42);
  });

  it('sends the first message without creating a session first (regression)', { timeout: 15000 }, async () => {
    const user = userEvent.setup();
    // Full-answer mode: this test pins the non-streaming transport.
    localStorage.setItem('ai-chat:stream', 'false');
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API_URL}/ai/chat`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ reply: 'Simmer for 15 minutes.', tokensUsed: 12 });
      }),
    );

    renderAssistant();

    // No "New" click — the first message itself creates the session.
    // Regression: the send ran on the mutation captured while no session was
    // active, so it always rejected with "Start a conversation first."
    await user.type(
      await screen.findByPlaceholderText('Ask about recipes, substitutions, meal plans…'),
      'How long do I simmer rice?',
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.getByText('Simmer for 15 minutes.')).toBeInTheDocument(), { timeout: 10000 });
    expect(
      (await screen.findAllByText('How long do I simmer rice?', {}, { timeout: 10000 })).length,
    ).toBeGreaterThan(0);
    expect(within(document.body).queryByText('Message not sent')).not.toBeInTheDocument();
    expect(body?.messages).toEqual([{ role: 'user', content: 'How long do I simmer rice?' }]);
  });

  it('notifies on backend failure and keeps the user message locally', { timeout: 15000 }, async () => {
    const user = userEvent.setup();
    // Full-answer mode: this test pins the non-streaming transport.
    localStorage.setItem('ai-chat:stream', 'false');
    server.use(
      http.post(`${API_URL}/ai/chat`, () => HttpResponse.json({ message: 'Model unavailable' }, { status: 503 })),
    );

    renderAssistant();

    await createChat(user);
    await user.type(
      await screen.findByPlaceholderText('Ask about recipes, substitutions, meal plans…'),
      'Substitute for buttermilk?',
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.getByText('Message not sent')).toBeInTheDocument(), { timeout: 10000 });
    expect(within(document.body).getByText('Model unavailable')).toBeInTheDocument();

    // The user message stays in the local transcript (and titles the chat);
    // nothing answered it.
    expect(
      (await screen.findAllByText('Substitute for buttermilk?', {}, { timeout: 10000 })).length,
    ).toBeGreaterThan(0);
    const messages = await chatDb.messages.toArray();
    expect(messages.map((message) => message.role)).toEqual(['user']);
  });

  it('auto-titles an unnamed chat from its first message', { timeout: 15000 }, async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API_URL}/ai/chat`, () => HttpResponse.json({ reply: 'Try simmering longer.', tokensUsed: 42 })),
    );

    renderAssistant();

    await createChat(user);
    await waitFor(() => expect(screen.getByText('Untitled chat')).toBeInTheDocument(), { timeout: 10000 });

    await user.type(
      screen.getByPlaceholderText('Ask about recipes, substitutions, meal plans…'),
      'How long do I simmer rice?',
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));
    // The streaming preview bubble swaps to the persisted bubble — assert on
    // the live DOM, not a node reference that the swap can detach.
    await waitFor(() => expect(screen.getByText('Try simmering longer.')).toBeInTheDocument(), { timeout: 10000 });

    // The text appears in the transcript bubble and the auto-titled sidebar row.
    expect(
      (await screen.findAllByText('How long do I simmer rice?', {}, { timeout: 10000 })).length,
    ).toBeGreaterThan(0);
    const sessions = await chatDb.sessions.toArray();
    expect(sessions[0].title).toBe('How long do I simmer rice?');
  });

  it('starts renaming the active chat in place immediately', { timeout: 15000 }, async () => {
    const user = userEvent.setup();
    renderAssistant();

    await createChat(user);
    await screen.findByText('Untitled chat', {}, { timeout: 10000 });

    // The active chat's sidebar pencil must open the editor right here, right now.
    await user.click(screen.getByLabelText('Rename conversation'));
    const input = await screen.findByRole('textbox', { name: 'Chat name' }, { timeout: 2000 });
    expect(input).toHaveValue('Untitled chat');
  });

  it('renames a chat in place, persists it, and cancels empty renames', { timeout: 15000 }, async () => {
    const user = userEvent.setup();
    renderAssistant();

    await createChat(user);
    await screen.findByText('Untitled chat', {}, { timeout: 10000 });

    await user.click(screen.getByLabelText('Rename conversation'));
    const input = await screen.findByRole('textbox', { name: 'Chat name' }, { timeout: 10000 });
    await user.clear(input);
    await user.type(input, 'Meal prep Q&A{Enter}');

    await waitFor(() => expect(screen.getByText('Meal prep Q&A')).toBeInTheDocument(), { timeout: 10000 });
    const sessions = await chatDb.sessions.toArray();
    expect(sessions[0].title).toBe('Meal prep Q&A');

    // An empty value cancels instead of saving a blank title.
    await user.click(screen.getByLabelText('Rename conversation'));
    const inputAgain = await screen.findByRole('textbox', { name: 'Chat name' }, { timeout: 10000 });
    await user.clear(inputAgain);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByText('Meal prep Q&A')).toBeInTheDocument(), { timeout: 10000 });
    expect(screen.queryByRole('textbox', { name: 'Chat name' })).not.toBeInTheDocument();
  });

  it('cancels an open rename when switching to another chat', { timeout: 15000 }, async () => {
    const user = userEvent.setup();
    renderAssistant();

    await createChat(user);
    await createChat(user);
    await screen.findAllByText('Untitled chat', {}, { timeout: 10000 });

    await user.click(screen.getAllByLabelText('Rename conversation')[0]);
    await screen.findByRole('textbox', { name: 'Chat name' }, { timeout: 10000 });

    // Switching chats abandons the edit — no sticky field in a background row.
    await user.click(screen.getAllByText('Untitled chat')[1]);
    expect(screen.queryByRole('textbox', { name: 'Chat name' })).not.toBeInTheDocument();
  });

  it('migrates legacy chats titled "New chat" from their first user message', { timeout: 15000 }, async () => {
    await chatDb.sessions.bulkAdd([
      {
        id: 'legacy-with-messages',
        title: 'New chat',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'legacy-empty',
        title: 'New chat',
        createdAt: '2026-01-01T00:00:01.000Z',
        updatedAt: '2026-01-01T00:00:01.000Z',
      },
    ]);
    await chatDb.messages.bulkAdd([
      {
        id: 'legacy-msg-1',
        sessionId: 'legacy-with-messages',
        role: 'user',
        content: 'How do I make ramen broth richer at home?',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    renderAssistant();

    // The 41-char message exceeds the auto-title cap, so the derived title is
    // the trimmed opening plus an ellipsis.
    const derivedTitle = deriveChatTitle('How do I make ramen broth richer at home?');
    expect(derivedTitle).not.toBe('How do I make ramen broth richer at home?');
    expect(await screen.findByText(derivedTitle, {}, { timeout: 10000 })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Untitled chat')).toBeInTheDocument(), { timeout: 10000 });

    const migrated = await chatDb.sessions.get('legacy-with-messages');
    expect(migrated?.title).toBe(derivedTitle);
    const empty = await chatDb.sessions.get('legacy-empty');
    expect(empty?.title).toBe('Untitled chat');
  });

  it('locks premium models for free users and sends the selected model', { timeout: 15000 }, async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API_URL}/ai/chat/stream`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return sseStreamResponse([
          'data: {"type":"delta","text":"Try simmering longer."}\n\n',
          'data: {"type":"done","text":"Try simmering longer.","modelId":null}\n\n',
        ]);
      }),
    );

    renderAssistant();
    await createChat(user);

    await user.click(await screen.findByRole('button', { name: 'Change AI model' }, { timeout: 10000 }));
    await waitFor(() => expect(screen.getByText('chef-pro')).toBeInTheDocument(), { timeout: 10000 });

    // Locked: the premium card notifies instead of selecting.
    await user.click(screen.getByRole('button', { name: /chef-pro/ }));
    expect(
      await screen.findByText('chef-pro requires a premium subscription.', {}, { timeout: 10000 }),
    ).toBeInTheDocument();

    // Select the free model — the picker closes and the next request carries it.
    await user.click(screen.getByRole('button', { name: /flash-mini/ }));
    await user.type(
      await screen.findByPlaceholderText('Ask about recipes, substitutions, meal plans…'),
      'How long do I simmer rice?',
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));

    // The streaming preview bubble swaps to the persisted bubble — assert on
    // the live DOM, not a node reference that the swap can detach.
    await waitFor(() => expect(screen.getByText('Try simmering longer.')).toBeInTheDocument(), { timeout: 10000 });
    expect(body?.modelId).toBe(IDS.modelEconomy);
  });

  it('lets premium users select premium-gated models', { timeout: 15000 }, async () => {
    seed('profiles', [profile({ subscription_tier: 'premium' })]);
    const user = userEvent.setup();
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API_URL}/ai/chat/stream`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return sseStreamResponse([
          'data: {"type":"delta","text":"Try simmering longer."}\n\n',
          'data: {"type":"done","text":"Try simmering longer.","modelId":null}\n\n',
        ]);
      }),
    );

    renderAssistant();
    await createChat(user);

    await user.click(await screen.findByRole('button', { name: 'Change AI model' }, { timeout: 10000 }));
    await screen.findByRole('button', { name: /chef-pro/ }, { timeout: 10000 });
    // The profile (and with it the premium gate) must be resolved before
    // selecting — re-query the card so no stale node survives the re-render.
    await waitFor(
      () => {
        const card = screen.getByRole('button', { name: /chef-pro/ });
        expect(within(card).queryByText('Premium')).not.toBeInTheDocument();
      },
      { timeout: 10000 },
    );
    await user.click(screen.getByRole('button', { name: /chef-pro/ }));

    await user.type(
      await screen.findByPlaceholderText('Ask about recipes, substitutions, meal plans…'),
      'How long do I simmer rice?',
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));

    // The streaming preview bubble swaps to the persisted bubble — assert on
    // the live DOM, not a node reference that the swap can detach.
    await waitFor(() => expect(screen.getByText('Try simmering longer.')).toBeInTheDocument(), { timeout: 10000 });
    expect(body?.modelId).toBe(IDS.modelAdvanced);
  });

  it('streams by default over the stream route and persists done.text', { timeout: 15000 }, async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${API_URL}/ai/chat/stream`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        // Deltas deliberately disagree with done.text — done is authoritative.
        return sseStreamResponse([
          'data: {"type":"meta","modelId":null}\n\n',
          'data: {"type":"delta","text":"Wrong partial."}\n\n',
          'data: {"type":"done","text":"Simmer it for 15 minutes.","modelId":null}\n\n',
        ]);
      }),
    );

    renderAssistant();
    await createChat(user);
    await user.type(
      await screen.findByPlaceholderText('Ask about recipes, substitutions, meal plans…'),
      'How long do I simmer rice?',
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.getByText('Simmer it for 15 minutes.')).toBeInTheDocument(), { timeout: 10000 });
    expect(typeof body?.sessionId).toBe('string');
    expect(body?.messages).toEqual([{ role: 'user', content: 'How long do I simmer rice?' }]);

    // Identical message shape to a full answer — no transport flag, no tokens.
    const messages = (await chatDb.messages.toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    expect(messages.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(messages[1].content).toBe('Simmer it for 15 minutes.');
    expect(messages[1].outcome).toBeUndefined();
    expect(messages[1].tokensUsed).toBeUndefined();
  });

  it('stops an in-flight stream, keeps the partial answer, and does not error', { timeout: 15000 }, async () => {
    const user = userEvent.setup();
    const encoder = new TextEncoder();
    server.use(
      http.post(`${API_URL}/ai/chat/stream`, () => {
        // One delta, then the stream never completes — only Stop can end it.
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('data: {"type":"delta","text":"Sim"}\n\n'));
          },
        });
        return new HttpResponse(stream, { headers: { 'content-type': 'text/event-stream' } });
      }),
    );

    renderAssistant();
    await createChat(user);
    await user.type(
      await screen.findByPlaceholderText('Ask about recipes, substitutions, meal plans…'),
      'How long do I simmer rice?',
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));

    // The partial answer grows as a bubble and the stop affordance appears.
    await waitFor(() => expect(screen.getByText('Sim')).toBeInTheDocument(), { timeout: 10000 });
    expect(screen.getByRole('button', { name: 'Stop generating' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stop generating' }));

    await waitFor(() => expect(screen.getByText('Stopped — partial answer')).toBeInTheDocument(), { timeout: 10000 });
    const messages = (await chatDb.messages.toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    expect(messages.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(messages[1]).toMatchObject({ content: 'Sim', outcome: 'stopped' });
    // The user chose to stop — not an error.
    expect(within(document.body).queryByText('Message not sent')).not.toBeInTheDocument();
  });

  it('marks a mid-stream failure, keeps the partial, and notifies', { timeout: 15000 }, async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API_URL}/ai/chat/stream`, () =>
        sseStreamResponse([
          'data: {"type":"delta","text":"Sim"}\n\n',
          'data: {"type":"error","message":"Model exploded mid-stream"}\n\n',
        ]),
      ),
    );

    renderAssistant();
    await createChat(user);
    await user.type(
      await screen.findByPlaceholderText('Ask about recipes, substitutions, meal plans…'),
      'How long do I simmer rice?',
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.getByText('Model exploded mid-stream')).toBeInTheDocument(), { timeout: 10000 });
    await waitFor(() => expect(screen.getByText('Failed — partial answer')).toBeInTheDocument(), { timeout: 10000 });
    const messages = (await chatDb.messages.toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    expect(messages[1]).toMatchObject({ content: 'Sim', outcome: 'failed' });
  });

  it('surfaces a pre-stream failure on the stream route like a failed send', { timeout: 15000 }, async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API_URL}/ai/chat/stream`, () =>
        HttpResponse.json({ message: 'Model unavailable' }, { status: 503 }),
      ),
    );

    renderAssistant();
    await createChat(user);
    await user.type(
      await screen.findByPlaceholderText('Ask about recipes, substitutions, meal plans…'),
      'How long do I simmer rice?',
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.getByText('Message not sent')).toBeInTheDocument(), { timeout: 10000 });
    expect(within(document.body).getByText('Model unavailable')).toBeInTheDocument();
    const messages = await chatDb.messages.toArray();
    expect(messages.map((message) => message.role)).toEqual(['user']);
  });

  it('toggles the stream preference in the options popup without a model row', { timeout: 15000 }, async () => {
    const user = userEvent.setup();

    renderAssistant();

    await user.click(await screen.findByRole('button', { name: 'Chat options' }, { timeout: 10000 }));
    const streamSwitch = await screen.findByRole('switch', { name: 'Stream answer' }, { timeout: 10000 });
    // Streaming is ON by default.
    expect(streamSwitch).toBeChecked();

    await user.click(streamSwitch);
    expect(localStorage.getItem('ai-chat:stream')).toBe('false');
    // Toggling keeps the popover open so the change stays visible.
    expect(screen.getByRole('switch', { name: 'Stream answer' })).not.toBeChecked();

    // Model selection moved to the header chip — no duplicate entry point here.
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
  });

  it('closes the options popup on click outside and on Escape', { timeout: 15000 }, async () => {
    const user = userEvent.setup();

    renderAssistant();

    await user.click(await screen.findByRole('button', { name: 'Chat options' }, { timeout: 10000 }));
    expect(await screen.findByRole('switch', { name: 'Stream answer' }, { timeout: 10000 })).toBeInTheDocument();

    await user.click(screen.getByText('Conversations'));
    expect(screen.queryByRole('switch', { name: 'Stream answer' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Chat options' }));
    // Escape lands on the focused panel control — interact, then dismiss.
    const reopenedSwitch = await screen.findByRole('switch', { name: 'Stream answer' }, { timeout: 10000 });
    await user.click(reopenedSwitch);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('switch', { name: 'Stream answer' })).not.toBeInTheDocument();
  });

  it('commits the rename when clicking outside the field', { timeout: 15000 }, async () => {
    const user = userEvent.setup();
    renderAssistant();

    await createChat(user);
    await screen.findByText('Untitled chat', {}, { timeout: 10000 });

    await user.click(screen.getByLabelText('Rename conversation'));
    const input = await screen.findByRole('textbox', { name: 'Chat name' }, { timeout: 10000 });
    await user.clear(input);
    await user.type(input, 'Blurred commit');
    // Clicking elsewhere blurs the field — the rename saves, nothing stays open.
    await user.click(screen.getByText('Conversations'));

    await waitFor(() => expect(screen.getByText('Blurred commit')).toBeInTheDocument(), { timeout: 10000 });
    expect(screen.queryByRole('textbox', { name: 'Chat name' })).not.toBeInTheDocument();
  });

  it('uses the full-answer route when streaming is off and accepts the canonical response shape', { timeout: 15000 }, async () => {
    localStorage.setItem('ai-chat:stream', 'false');
    const user = userEvent.setup();
    server.use(
      http.post(`${API_URL}/ai/chat`, () => HttpResponse.json({ text: 'Full canonical answer.', modelId: IDS.modelEconomy })),
    );

    renderAssistant();
    await createChat(user);
    await user.type(
      await screen.findByPlaceholderText('Ask about recipes, substitutions, meal plans…'),
      'How long do I simmer rice?',
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.getByText('Full canonical answer.')).toBeInTheDocument(), { timeout: 10000 });
    const messages = (await chatDb.messages.toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    expect(messages[1].content).toBe('Full canonical answer.');
  });
});
