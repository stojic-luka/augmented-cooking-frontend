/** Placeholder title for chats the user has not named yet. */
export const UNTITLED_CHAT_TITLE = 'Untitled chat';

/** Default title written by chat versions predating naming — the migration marker. */
export const LEGACY_DEFAULT_CHAT_TITLE = 'New chat';

export const AUTO_TITLE_MAX_CHARS = 40;

/**
 * Auto-title derived from a chat's first user message: the opening run of the
 * message, collapsed to one line and capped with an ellipsis.
 */
export function deriveChatTitle(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) return UNTITLED_CHAT_TITLE;
  if (normalized.length <= AUTO_TITLE_MAX_CHARS) return normalized;
  return `${normalized.slice(0, AUTO_TITLE_MAX_CHARS).trimEnd()}…`;
}
