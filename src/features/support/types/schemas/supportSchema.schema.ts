import { publicSeveritySchema, publicTicketCategorySchema } from '@/types/schemas';
import { z } from 'zod';

export const newTicketFormSchema = z.object({
  subject: z.string().min(3, { error: 'Give the ticket a short subject' }).max(120, { error: 'Subject is too long' }),
  category: publicTicketCategorySchema,
  severity: publicSeveritySchema,
  description: z.string().min(10, { error: 'Describe the issue in at least 10 characters' }),
});

export type NewTicketFormValues = z.infer<typeof newTicketFormSchema>;
