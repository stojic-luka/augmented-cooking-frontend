import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { clientConfig } from '@/config';

export type SupabaseBrowserClient = SupabaseClient<Database, 'public', 'public', Database['public']>;

let client: SupabaseBrowserClient | undefined;

export function getSupabaseBrowserClient(): SupabaseBrowserClient {
  if (typeof window === 'undefined') {
    throw new Error(
      'getSupabaseBrowserClient() was called outside the browser. ' +
        'Use the server client (or your NestJS backend) for server-side data access.',
    );
  }

  client ??= createClient<Database>(clientConfig.supabase.url, clientConfig.supabase.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      flowType: 'pkce',
    },
  });

  return client;
}
