export const aiChatKeys = {
  all: ['ai-chat'] as const,
  sessions: () => [...aiChatKeys.all, 'sessions'] as const,
  messages: (sessionId: string) => [...aiChatKeys.all, 'messages', sessionId] as const,
};
