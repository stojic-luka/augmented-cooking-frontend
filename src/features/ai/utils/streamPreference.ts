import { z } from 'zod';

/** Global (not per-chat) stream preference — lives outside the chat record and never touches the request body. */
export const STREAM_PREFERENCE_STORAGE_KEY = 'ai-chat:stream';

const storedValueSchema = z.enum(['true', 'false']).catch('true');

/** Streaming is ON unless the user explicitly turned it off. */
export function readStreamAnswerPreference(): boolean {
  try {
    return storedValueSchema.parse(window.localStorage.getItem(STREAM_PREFERENCE_STORAGE_KEY)) === 'true';
  } catch {
    return true;
  }
}

export function writeStreamAnswerPreference(streamAnswer: boolean): void {
  try {
    window.localStorage.setItem(STREAM_PREFERENCE_STORAGE_KEY, String(streamAnswer));
  } catch {
    // Storage unavailable (privacy mode) — the toggle still works for this page load.
  }
}
