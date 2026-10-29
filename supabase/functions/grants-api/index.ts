import { createClient } from '@supabase/supabase-js';
import { handleApi } from '../../../lib/server/api.ts';
import type { Database } from '../../../lib/database.types.ts';
import { seedBaseline } from './fixtures.ts';

Deno.serve(async (request: Request) => {
  const url = new URL(request.url);
  const marker = '/grants-api/';
  const path = url.pathname.includes(marker) ? url.pathname.split(marker)[1] : url.pathname.replace(/^\/grants-api\/?/, '');
  url.pathname = `/api/${path}`;
  const projectUrl = Deno.env.get('SUPABASE_URL');
  const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!projectUrl || !serverKey) return Response.json({ message: 'Demo API configuration is unavailable.' }, { status: 503 });
  const client = createClient<Database>(projectUrl, serverKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return handleApi(new Request(url, request), client, seedBaseline);
});
