import { z } from 'zod';
import { api } from '@/api';
import { getSupabaseBrowserClient } from '@lib/supabase';
import { clientConfig } from '@config/client';
import { AI_API_ROUTES } from '../api';
import type { ChatRole } from '../types';

const chatResponseSchema = z
  .object({
    // Contract shape: { text, modelId }. Servers predating the contract answer
    // with { reply, tokensUsed } — accept both, prefer the canonical key.
    text: z.string().optional(),
    reply: z.string().optional(),
    modelId: z.string().nullable().optional(),
    tokensUsed: z.number().int().nonnegative().catch(0),
  })
  .refine((value) => typeof value.text === 'string' || typeof value.reply === 'string', {
    error: 'Chat response contained no answer text.',
  });

const errorBodySchema = z.object({ message: z.string() }).nullable().catch(null);

const modelIdSchema = z.uuidv4();

/** The backend accepts 1..100 turns per request; the most recent are kept. */
export const MAX_CHAT_TURNS = 100;

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

/** SendChatMessageBodyDto — identical for the full-answer and the stream route. */
export interface SendChatMessageBody {
  sessionId: string;
  messages: ChatTurn[];
  /** Omitted entirely when unset — never null, never an empty string. */
  modelId?: string;
}

export interface ChatAnswer {
  text: string;
  /** The model the server actually used (its default when the request omitted one). */
  modelId: string | null;
  tokensUsed: number;
}

/**
 * One body builder for both transports: caps the history at the most recent
 * 100 turns and only places modelId on the wire when it is a UUIDv4.
 */
export function buildChatBody(sessionId: string, messages: ChatTurn[], modelId?: string | null): SendChatMessageBody {
  const body: SendChatMessageBody = { sessionId, messages: messages.slice(-MAX_CHAT_TURNS) };

  if (modelId && modelIdSchema.safeParse(modelId).success) {
    body.modelId = modelId;
  }

  return body;
}

/**
 * Sends the recent conversation to the assistant endpoint and gets one
 * complete answer.
 */
export async function sendChatMessage(
  sessionId: string,
  messages: ChatTurn[],
  modelId?: string | null,
): Promise<ChatAnswer> {
  const response = await api.post<unknown>(AI_API_ROUTES.chat, buildChatBody(sessionId, messages, modelId));
  const parsed = chatResponseSchema.parse(response.data);
  return { text: parsed.text ?? parsed.reply ?? '', modelId: parsed.modelId ?? null, tokensUsed: parsed.tokensUsed };
}

/* ------------------------------------------------------------------ */
/* Streaming — POST {chat}/stream over fetch, Server-Sent Events body. */
/* ------------------------------------------------------------------ */

export type ChatStreamEvent =
  | { type: 'meta'; modelId: string | null }
  | { type: 'delta'; text: string }
  | { type: 'done'; text: string; modelId: string | null }
  | { type: 'error'; message: string };

const STREAM_CONTENT_TYPE = 'text/event-stream';

const streamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('meta'), modelId: z.string().nullable().optional() }),
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({ type: z.literal('done'), text: z.string(), modelId: z.string().nullable().optional() }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);

/** Same auth headers the axios client attaches, from the same session source. */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  if (!token) {
    throw new Error('Request blocked: User is not authenticated.');
  }

  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

/** Mirrors axios's baseURL joining (axios does not reset on leading `/`). */
function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

async function throwResponseError(response: Response): Promise<never> {
  const body = errorBodySchema.parse(await response.json().catch(() => null));
  throw new Error(body?.message || `Request failed with status code ${response.status}.`);
}

/** Splits buffered text into complete frames; the tail stays in the buffer. */
function extractSseFrames(buffer: string): { frames: string[]; rest: string } {
  const parts = buffer.replace(/\r\n/g, '\n').split('\n\n');
  const rest = parts.pop() ?? '';
  return { frames: parts, rest };
}

/** A frame's `data:` lines joined; comment (`:`) and unknown lines ignored. */
function parseSseFrame(frame: string): unknown | undefined {
  const dataLines = frame
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(line.startsWith('data: ') ? 6 : 5));

  if (dataLines.length === 0) return undefined;

  try {
    return JSON.parse(dataLines.join('\n')) as unknown;
  } catch {
    return undefined;
  }
}

function parseStreamEvent(data: unknown): ChatStreamEvent | undefined {
  const result = streamEventSchema.safeParse(data);
  if (!result.success) return undefined;

  const event = result.data;
  if (event.type === 'meta') return { type: 'meta', modelId: event.modelId ?? null };
  if (event.type === 'done') return { type: 'done', text: event.text, modelId: event.modelId ?? null };
  return event;
}

/**
 * Streams one assistant answer from the stream route. `onEvent` receives every
 * parsed meta/delta/done frame; an `error` frame rejects with the frame's
 * message, as do pre-stream failures (non-2xx or a non-SSE response body).
 * Aborting `signal` rejects the in-flight read with an AbortError.
 */export async function streamChatMessage(params: {
  body: SendChatMessageBody;
  onEvent: (event: ChatStreamEvent) => void;
  signal: AbortSignal;
}): Promise<void> {
  const { body, onEvent, signal } = params;

  const response = await fetch(joinUrl(clientConfig.api.url, AI_API_ROUTES.chatStream), {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok || !(response.headers.get('content-type') ?? '').includes(STREAM_CONTENT_TYPE)) {
    await throwResponseError(response);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Streaming is not supported in this environment.');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  const consumeFrame = (frame: string) => {
    const event = parseStreamEvent(parseSseFrame(frame));
    if (!event) return;
    if (event.type === 'error') {
      throw new Error(event.message);
    }
    onEvent(event);
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const { frames, rest } = extractSseFrames(buffer);
      buffer = rest;
      for (const frame of frames) consumeFrame(frame);
    }

    // Flush the decoder and tolerate a final frame without a trailing blank line.
    buffer += decoder.decode();
    for (const frame of extractSseFrames(`${buffer}\n\n`).frames) consumeFrame(frame);
  } finally {
    reader.releaseLock();
  }
}
