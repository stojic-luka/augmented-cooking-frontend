import { z } from 'zod';

export const collectionFormSchema = z.object({
  name: z.string().min(1, { error: 'Name is required' }).max(80, { error: 'Name is too long' }),
  description: z.string().max(500, { error: 'Description is too long' }),
  isPublic: z.boolean(),
});

export type CollectionFormValues = z.infer<typeof collectionFormSchema>;
