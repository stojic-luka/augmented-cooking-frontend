import { z } from 'zod';

export const numeric = z.union([z.number(), z.string()]).transform(Number);
