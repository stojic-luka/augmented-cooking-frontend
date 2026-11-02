import { useEffect } from 'react';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { getSupabaseBrowserClient } from '@lib/supabase';
import { moderatorKeys } from '../query-keys';
import { fetchTicketQueue, fetchTicketThread, sendTicketMessage, setTicketStatus } from '../services';
import type { PublicSupportStatus } from '@/types/schemas';

export const ticketQueueOptions = () =>
  queryOptions({
    queryKey: moderatorKeys.tickets(),
    queryFn: fetchTicketQueue,
  });
export const useTicketQueue = () => useQuery(ticketQueueOptions());

export const useTicketThreadOptions = (ticketId: string | null) =>
  queryOptions({
    queryKey: moderatorKeys.ticketMessages(ticketId ?? 'none'),
    queryFn: () => fetchTicketThread(ticketId as string),
    enabled: Boolean(ticketId),
  });
export function useTicketThread(ticketId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery(useTicketThreadOptions(ticketId));

  // Realtime: support_ticket_messages is in the supabase_realtime publication —
  // incoming user messages should appear without a manual refetch.
  useEffect(() => {
    if (!ticketId) return;

    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel(`ticket-thread-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_ticket_messages',
          filter: `ticket_id=eq.${ticketId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: moderatorKeys.ticketMessages(ticketId),
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId, queryClient]);

  return query;
}

export function useReplyToTicket(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, body }: { ticketId: string; body: string }) => {
      if (!userId) return Promise.reject(new Error('Sign in first.'));
      return sendTicketMessage(ticketId, userId, body);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: moderatorKeys.ticketMessages(variables.ticketId) });
      queryClient.invalidateQueries({ queryKey: moderatorKeys.tickets() });
    },
  });
}

interface SetTicketStatusFnProps {
  ticketId: string;
  status: PublicSupportStatus;
}
export function useSetTicketStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, status }: Readonly<SetTicketStatusFnProps>) => setTicketStatus(ticketId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moderatorKeys.tickets() });
      notifications.show({ message: 'Ticket updated.', color: 'green' });
    },
  });
}
