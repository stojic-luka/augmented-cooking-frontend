import { restHandlers } from './rest';
import { supabaseHandlers } from './supabase';

export const handlers = [...restHandlers, ...supabaseHandlers];
