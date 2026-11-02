import dexie from 'dexie';
import { chatDb } from '../lib/chatDb';
import { deriveChatTitle, LEGACY_DEFAULT_CHAT_TITLE, UNTITLED_CHAT_TITLE } from '../utils/chatTitle';
import type { ChatMessage, ChatRole, ChatSession } from '../types';

function newId(): string {
  return crypto.randomUUID();
}

export async function listSessions(): Promise<ChatSession[]> {
  const sessions = await chatDb.sessions.orderBy('updatedAt').reverse().toArray();
  return migrateLegacyTitles(sessions);
}

export async function createSession(title = UNTITLED_CHAT_TITLE): Promise<ChatSession> {
  const now = new Date().toISOString();
  const session: ChatSession = { id: newId(), title, createdAt: now, updatedAt: now };
  await chatDb.sessions.add(session);
  return session;
}

export async function getSession(sessionId: string): Promise<ChatSession | undefined> {
  return chatDb.sessions.get(sessionId);
}

export async function renameSession(sessionId: string, title: string): Promise<void> {
  await chatDb.sessions.update(sessionId, { title });
}

export async function setSessionModel(sessionId: string, modelId: string | null): Promise<void> {
  await chatDb.sessions.update(sessionId, { modelId });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await chatDb.transaction('rw', chatDb.sessions, chatDb.messages, async () => {
    await chatDb.messages.where('sessionId').equals(sessionId).delete();
    await chatDb.sessions.delete(sessionId);
  });
}

export async function getMessages(sessionId: string): Promise<ChatMessage[]> {
  if (!sessionId) return [];
  // Range scan over the compound [sessionId+createdAt] index: rows come back
  // ordered without loading the session and re-sorting in JS.
  return chatDb.messages
    .where('[sessionId+createdAt]')
    .between([sessionId, dexie.minKey], [sessionId, dexie.maxKey], true, true)
    .toArray();
}

export async function appendMessage(
  sessionId: string,
  role: ChatRole,
  content: string,
  tokensUsed?: number,
  outcome?: 'stopped' | 'failed',
): Promise<ChatMessage> {
  const message: ChatMessage = {
    id: newId(),
    sessionId,
    role,
    content,
    createdAt: new Date().toISOString(),
    tokensUsed,
    ...(outcome && { outcome }),
  };
  await chatDb.messages.add(message);
  await chatDb.sessions.update(sessionId, { updatedAt: new Date().toISOString() });
  return message;
}

/**
 * Chats stored before naming existed carry the legacy default title. Retitle
 * them from their first user message (or "Untitled chat" when they have no
 * messages yet) and persist the result — additive on the title only, message
 * history is untouched, and the fixup runs at most once per chat.
 */
async function migrateLegacyTitles(sessions: ChatSession[]): Promise<ChatSession[]> {
  const legacy = sessions.filter((session) => session.title === LEGACY_DEFAULT_CHAT_TITLE);
  if (legacy.length === 0) return sessions;

  const retitled = new Map<string, string>();
  await Promise.all(
    legacy.map(async (session) => {
      const firstUserMessage = await chatDb.messages
        .where('[sessionId+createdAt]')
        .between([session.id, dexie.minKey], [session.id, dexie.maxKey], true, true)
        .filter((message) => message.role === 'user')
        .first();
      const title = firstUserMessage ? deriveChatTitle(firstUserMessage.content) : UNTITLED_CHAT_TITLE;
      retitled.set(session.id, title);
      await chatDb.sessions.update(session.id, { title });
    }),
  );

  return sessions.map((session) => {
    const nextTitle = retitled.get(session.id);
    return nextTitle ? { ...session, title: nextTitle } : session;
  });
}
