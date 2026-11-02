import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supportKeys } from '../query-keys';
import { addTicketMessage, createBugReport, createTicket, fetchMyTickets, fetchTicketMessages } from '../services';
import type { NewTicketFormValues } from '../types';
import { useEffect } from 'react';
import { getSupabaseBrowserClient } from '@lib/supabase';

export const useMyTicketsOptions = (userId: string | null) =>
  queryOptions({
    queryKey: supportKeys.mine(userId ?? 'anonymous'),
    queryFn: () => fetchMyTickets(userId as string),
    enabled: Boolean(userId),
  });
export const useMyTickets = (userId: string | null) => useQuery(useMyTicketsOptions(userId));

export const useTicketMessagesOptions = (ticketId: string | null) =>
  queryOptions({
    queryKey: supportKeys.messages(ticketId ?? 'none'),
    queryFn: () => fetchTicketMessages(ticketId as string),
    enabled: Boolean(ticketId),
  });
export const useTicketMessages = (ticketId: string | null) => {
  const queryClient = useQueryClient();

  const query = useQuery(useTicketMessagesOptions(ticketId));

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
            queryKey: supportKeys.messages(ticketId),
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId, queryClient]);

  return query;
};

export function useCreateTicket(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: NewTicketFormValues) => {
      if (!userId) return Promise.reject(new Error('Sign in to open a ticket.'));
      return createTicket(userId, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportKeys.all });
    },
  });
}

export function useSendTicketMessage(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, body }: { ticketId: string; body: string }) => {
      if (!userId) return Promise.reject(new Error('Sign in first.'));
      return addTicketMessage(ticketId, userId, body);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: supportKeys.messages(variables.ticketId) });
      queryClient.invalidateQueries({ queryKey: supportKeys.all });
    },
  });
}

export function useCreateBugReport(userId: string | null) {
  return useMutation({
    mutationFn: (input: { title: string; description: string; severity: 'low' | 'medium' | 'high' }) => {
      if (!userId) return Promise.reject(new Error('Sign in first.'));
      return createBugReport(userId, input);
    },
  });
}
