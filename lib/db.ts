import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Configure SUPABASE_URL and SUPABASE_SECRET_KEY.');
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
