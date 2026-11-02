import Dexie, { type EntityTable } from 'dexie';
import type { ChatSession, ChatMessage } from '../types';

export const chatDb = new Dexie('augmented-cooking-chat') as Dexie & {
  sessions: EntityTable<ChatSession, 'id'>;
  messages: EntityTable<ChatMessage, 'id'>;
};

chatDb.version(1).stores({
  sessions: 'id, updatedAt',
  messages: 'id, sessionId, [sessionId+createdAt]',
});
