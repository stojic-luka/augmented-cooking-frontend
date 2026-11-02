import { getSupabaseBrowserClient } from '@lib/supabase';
import type { NewTicketFormValues } from '../types';
import { publicSupportTicketMessagesRowSchema, publicSupportTicketsRowSchema } from '@/types/schemas';
import type { PublicSupportTicketMessagesRow, PublicSupportTicketsRow } from '@/types/schemas';

export async function createTicket(userId: string, input: NewTicketFormValues): Promise<PublicSupportTicketsRow> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      user_id: userId,
      subject: input.subject.trim(),
      category: input.category,
      severity: input.severity,
      description: input.description.trim(),
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to submit ticket: ${error.message}`);
  }

  return publicSupportTicketsRowSchema.parse(data);
}

export async function fetchMyTickets(userId: string): Promise<PublicSupportTicketsRow[]> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch tickets: ${error.message}`);
  }

  return publicSupportTicketsRowSchema.array().parse(data ?? []);
}

export async function fetchTicketMessages(ticketId: string): Promise<PublicSupportTicketMessagesRow[]> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from('support_ticket_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch messages: ${error.message}`);
  }

  return publicSupportTicketMessagesRowSchema.array().parse(data ?? []);
}

export async function addTicketMessage(
  ticketId: string,
  userId: string,
  body: string,
): Promise<PublicSupportTicketMessagesRow> {
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from('support_ticket_messages')
    .insert({ ticket_id: ticketId, sender_id: userId, sender_role: 'user', body: body.trim() })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to send message: ${error.message}`);
  }

  return publicSupportTicketMessagesRowSchema.parse(data);
}

export async function createBugReport(
  userId: string,
  input: { title: string; description: string; severity: 'low' | 'medium' | 'high' },
): Promise<void> {
  const supabase = getSupabaseBrowserClient();

  // There is no bug_reports table — bug reports ARE support tickets with
  // category 'bug' (they land in the staff queue and resolve the same way).
  const { error } = await supabase.from('support_tickets').insert({
    user_id: userId,
    subject: input.title.trim(),
    category: 'bug',
    severity: input.severity,
    description: input.description.trim(),
  });

  if (error) {
    throw new Error(`Failed to submit bug report: ${error.message}`);
  }
}
