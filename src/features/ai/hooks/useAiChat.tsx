import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { aiChatKeys } from '../services/chatStorageQueryKeys';
import {
  appendMessage,
  createSession,
  deleteSession,
  getMessages,
  getSession,
  listSessions,
  renameSession,
  setSessionModel,
} from '../services/chatStorage';
import {
  buildChatBody,
  sendChatMessage,
  streamChatMessage,
  type ChatStreamEvent,
} from '../services/chatApi';
import { useAiModels } from './useAiModels';
import { useAuthUser } from '@features/auth/providers/user';
import { resolveChatModelId } from '../utils/modelAccess';
import { deriveChatTitle, UNTITLED_CHAT_TITLE } from '../utils/chatTitle';
import { readStreamAnswerPreference } from '../utils/streamPreference';

export function useChatSessions() {
  return useQuery({
    queryKey: aiChatKeys.sessions(),
    queryFn: listSessions,
    staleTime: 0,
  });
}

export function useChatMessages(sessionId: string | null) {
  return useQuery({
    queryKey: aiChatKeys.messages(sessionId ?? 'none'),
    queryFn: () => getMessages(sessionId as string),
    enabled: Boolean(sessionId),
    staleTime: 0,
  });
}

export function useCreateChatSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title?: string) => createSession(title),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: aiChatKeys.sessions() }),
  });
}

export function useRenameChatSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, title }: { sessionId: string; title: string }) => renameSession(sessionId, title),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: aiChatKeys.sessions() }),
  });
}

export function useSetChatModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, modelId }: { sessionId: string; modelId: string | null }) =>
      setSessionModel(sessionId, modelId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: aiChatKeys.sessions() }),
  });
}

export function useDeleteChatSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => deleteSession(sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: aiChatKeys.sessions() }),
  });
}

interface TitledError {
  title: string;
}

function hasTitle(error: unknown): error is Error & TitledError {
  return typeof (error as { title?: unknown }).title === 'string';
}

function chatError(message: string, title: string): Error & TitledError {
  return Object.assign(new Error(message), { title });
}

export function notifyChatError(error: Error) {
  notifications.show({
    title: hasTitle(error) ? error.title : 'Message not sent',
    message: error.message,
    color: 'red',
  });
}

/** Live state of an in-flight streamed answer, rendered as a growing bubble. */
interface StreamPreview {
  active: boolean;
  text: string;
  sessionId: string | null;
}

const IDLE_STREAM_PREVIEW: StreamPreview = { active: false, text: '', sessionId: null };

/**
 * Sends the user's message and persists both turns. The transport — complete
 * answer (POST /ai/chat) or streamed answer (POST /ai/chat/stream, the global
 * "ai-chat:stream" preference, ON by default) — is read fresh at send time;
 * both modes finalize the exact same local history shape.
 *
 * `sessionId` may be passed per call: a session created in this same
 * interaction (first message on a fresh page) must not wait for a re-render
 * to hand the hook its id — the mutation created before that re-render would
 * still see `sessionId === null` and reject the send.
 *
 * The modelId for the request is resolved here: the chat's stored model →
 * the profile's default (if selectable) → the first selectable model → omit.
 * Resolution never blocks the send; a stale stored model falls back with one
 * notification, and a failed model catalog just omits modelId.
 */
export function useSendChatMessage(sessionId: string | null) {
  const queryClient = useQueryClient();
  const { profile } = useAuthUser();
  const modelsQuery = useAiModels(true);
  const catalogWarnedRef = useRef(false);

  // The hook owns the AbortController: `abort()` stops the in-flight stream,
  // and unmount always aborts. Chat switches abort via `abort()` from the page.
  const abortRef = useRef<AbortController | null>(null);
  const [stream, setStream] = useState<StreamPreview>(IDLE_STREAM_PREVIEW);

  useEffect(() => () => abortRef.current?.abort(), []);

  const mutation = useMutation({
    mutationFn: async ({ content, sessionId: explicitSessionId }: { content: string; sessionId?: string }) => {
      const activeSessionId = explicitSessionId ?? sessionId;
      if (!activeSessionId) {
        throw new Error('Start a conversation first.');
      }

      const [history, session] = await Promise.all([getMessages(activeSessionId), getSession(activeSessionId)]);

      // First message on a still-untitled chat names the chat after itself.
      if (history.length === 0 && session && session.title === UNTITLED_CHAT_TITLE) {
        await renameSession(activeSessionId, deriveChatTitle(content));
        queryClient.invalidateQueries({ queryKey: aiChatKeys.sessions() });
      }

      await appendMessage(activeSessionId, 'user', content);
      // Show the user's turn immediately — the reply's invalidation is far
      // too late for it.
      queryClient.invalidateQueries({ queryKey: aiChatKeys.messages(activeSessionId) });

      const turns = [...history, { role: 'user' as const, content }].map((message) => ({
        role: message.role,
        content: message.content,
      }));

      if (!modelsQuery.data && modelsQuery.isError && !catalogWarnedRef.current) {
        catalogWarnedRef.current = true;
        notifications.show({
          message: 'The model list is unavailable — using the server default model for this chat.',
          color: 'gray',
        });
      }

      const resolved = resolveChatModelId({
        models: modelsQuery.data,
        storedModelId: session?.modelId ?? null,
        profileModelId: profile?.ai_model_id ?? null,
        subscriptionTier: profile?.subscription_tier ?? 'free',
      });

      if (resolved.staleModel) {
        const reason = resolved.staleReason === 'premium' ? 'requires a premium subscription' : 'is no longer available';
        notifications.show({
          title: 'Model switched',
          message: resolved.replacementModel
            ? `${resolved.staleModel.name} ${reason} — switched to ${resolved.replacementModel.name}.`
            : `${resolved.staleModel.name} ${reason} — switched to the server default model.`,
          color: 'yellow',
        });
        // Persist the fallback so the guard does not re-fire on every send.
        await setSessionModel(activeSessionId, resolved.modelId);
        queryClient.invalidateQueries({ queryKey: aiChatKeys.sessions() });
      }

      if (readStreamAnswerPreference()) {
        const controller = new AbortController();
        abortRef.current = controller;

        // Accumulated locally AND authoritative-reconciled on the done frame.
        let accumulated = '';
        try {
          setStream({ active: true, text: '', sessionId: activeSessionId });
          await streamChatMessage({
            body: buildChatBody(activeSessionId, turns, resolved.modelId),
            signal: controller.signal,
            onEvent: (event: ChatStreamEvent) => {
              if (event.type === 'delta') {
                accumulated += event.text;
                setStream((prev) => (prev.active ? { ...prev, text: prev.text + event.text } : prev));
              } else if (event.type === 'done') {
                // done.text is authoritative — replace the accumulated deltas.
                accumulated = event.text;
                setStream((prev) => (prev.active ? { ...prev, text: accumulated } : prev));
              }
            },
          });

          if (accumulated) {
            await appendMessage(activeSessionId, 'assistant', accumulated);
            // Refetch before the preview clears so the bubble never blanks out.
            await queryClient.invalidateQueries({ queryKey: aiChatKeys.messages(activeSessionId) });
          }
        } catch (error) {
          const stopped = controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError');
          if (stopped) {
            // The user chose to stop: keep the partial answer, no error toast.
            if (accumulated && (await getSession(activeSessionId))) {
              await appendMessage(activeSessionId, 'assistant', accumulated, undefined, 'stopped');
              await queryClient.invalidateQueries({ queryKey: aiChatKeys.messages(activeSessionId) });
            }
            return;
          }

          if (accumulated) {
            // Mid-stream failure: keep the partial answer marked as failed and
            // let the error surface (the page shows the notification).
            if (await getSession(activeSessionId)) {
              await appendMessage(activeSessionId, 'assistant', accumulated, undefined, 'failed');
              await queryClient.invalidateQueries({ queryKey: aiChatKeys.messages(activeSessionId) });
            }
            throw chatError(error instanceof Error ? error.message : 'Streaming failed.', 'Answer interrupted');
          }

          // Pre-stream failure — nothing was sent, nothing partial to keep.
          throw error instanceof Error ? error : new Error('Streaming failed.');
        } finally {
          abortRef.current = null;
          setStream(IDLE_STREAM_PREVIEW);
        }
        return;
      }

      const { text, tokensUsed } = await sendChatMessage(activeSessionId, turns, resolved.modelId);
      await appendMessage(activeSessionId, 'assistant', text, tokensUsed);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: aiChatKeys.messages(variables.sessionId ?? sessionId ?? 'none') });
      queryClient.invalidateQueries({ queryKey: aiChatKeys.sessions() });
    },
    onError: (_error, variables) => {
      queryClient.invalidateQueries({ queryKey: aiChatKeys.messages(variables.sessionId ?? sessionId ?? 'none') });
    },
  });

  return {
    ...mutation,
    isStreaming: stream.active,
    streamedText: stream.text,
    streamedSessionId: stream.sessionId,
    abort: () => abortRef.current?.abort(),
  };
}
