import { treeifyError, z } from 'zod';

const envSchema = z.object({
  VITE_API_URL: z.url('VITE_API_URL is not set or not a valid URL'),
  VITE_SUPABASE_URL: z.url('VITE_SUPABASE_URL is not set or not a valid URL'),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1, 'VITE_SUPABASE_PUBLISHABLE_KEY is not set'),
});

const configSchema = envSchema.transform((env) => ({
  api: {
    url: env.VITE_API_URL,
  },
  supabase: {
    url: env.VITE_SUPABASE_URL,
    publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
  },
}));

function getConfig() {
  const result = configSchema.safeParse(import.meta.env);

  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${JSON.stringify(treeifyError(result.error), null, 2)}`);
  }

  return result.data;
}

export const clientConfig = getConfig();
export type ClientConfig = z.output<typeof configSchema>;
