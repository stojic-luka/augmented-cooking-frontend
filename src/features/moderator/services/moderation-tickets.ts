import { z } from 'zod';
import { getSupabaseBrowserClient } from '@lib/supabase';
import {
  publicSupportTicketMessagesInsertSchema,
  publicSupportTicketMessagesRowSchema,
  publicSupportTicketsRowSchema,
} from '@/types/schemas';
import type { PublicSupportTicketMessagesRow, PublicSupportStatus, PublicAppRole } from '@/types/schemas';

export const ModTicketSchema = publicSupportTicketsRowSchema.extend({
  requester_display_name: z.string().nullable(),
});
export type ModTicket = z.infer<typeof ModTicketSchema>;

export async function fetchTicketQueue(): Promise<ModTicket[]> {
  const supabase = getSupabaseBrowserClient();

  // profiles is RLS-locked to the owner's own row — other users are only
  // readable through the public_profile_info view. Both user_id and assignee_id
  // FK into it, so the embed must be disambiguated with the FK name.
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*, requester:public_profile_info!support_tickets_user_id_fkey(display_name)')
    .neq('status', 'resolved')
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch tickets: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const ticket = publicSupportTicketsRowSchema.parse(row);
    return {
      ...ticket,
      requester_display_name: row.requester?.display_name ?? null,
    };
  });
}

export async function fetchTicketThread(ticketId: string): Promise<PublicSupportTicketMessagesRow[]> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from('support_ticket_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch messages: ${error.message}`);
  }

  return (data ?? []).map((row) => publicSupportTicketMessagesRowSchema.parse(row));
}

export async function sendTicketMessage(
  ticketId: string,
  senderId: string,
  body: string,
  senderRole: PublicAppRole = 'moderator',
): Promise<PublicSupportTicketMessagesRow> {
  const supabase = getSupabaseBrowserClient();

  const payload = publicSupportTicketMessagesInsertSchema.parse({
    ticket_id: ticketId,
    sender_id: senderId,
    sender_role: senderRole,
    body: body.trim(),
  });

  const { data, error } = await supabase.from('support_ticket_messages').insert(payload).select('*').single();

  if (error) {
    throw new Error(`Failed to send message: ${error.message}`);
  }

  return publicSupportTicketMessagesRowSchema.parse(data);
}

/**
 * support_tickets UPDATE is denied to clients entirely (staff-only via
 * SECURITY DEFINER RPC), so this goes through `update_support_ticket` —
 * the server sets updated_at itself.
 */
export async function setTicketStatus(ticketId: string, status: PublicSupportStatus): Promise<void> {
  const supabase = getSupabaseBrowserClient();

  const { error } = await supabase.rpc('update_support_ticket', {
    p_ticket: ticketId,
    p_status: status,
  });

  if (error) {
    throw new Error(`Failed to update ticket: ${error.message}`);
  }
}
