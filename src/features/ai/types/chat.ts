import { z } from 'zod';

export const chatRoleSchema = z.enum(['user', 'assistant']);
export type ChatRole = z.infer<typeof chatRoleSchema>;

export interface ChatSession {
  id: string;
  title: string;
  /** Model preference for this chat (ai_models.id); null = resolve at send time. */
  modelId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  tokensUsed?: number;
  /** Only on incomplete answers: user-stopped or failed mid-stream. Complete answers (both transports) never set it. */
  outcome?: 'stopped' | 'failed';
}
