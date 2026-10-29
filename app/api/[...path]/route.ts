import { NextRequest } from 'next/server';
import { db } from '../../../lib/db';
import { handleApi } from '../../../lib/server/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function handle(req: NextRequest) {
  const edge = process.env.SUPABASE_EDGE_FUNCTION_URL;
  if (!edge) {
    try { return await handleApi(req, db()); }
    catch { return Response.json({ message: 'Configure the demo API connection, then retry.' }, { status: 503 }); }
  }
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) return Response.json({ message: 'The demo API connection is not configured.' }, { status: 503 });
  try {
    const path = req.nextUrl.pathname.replace(/^\/api\//, '');
    const response = await fetch(`${edge}/${path}${req.nextUrl.search}`, {
      method: req.method, cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'x-demo-user': req.headers.get('x-demo-user') || '',
        apikey: key, Authorization: `Bearer ${key}` },
      ...(req.method === 'GET' ? {} : { body: await req.text() }),
      signal: AbortSignal.timeout(55_000),
    });
    return new Response(response.body, { status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ code: 'SERVICE_UNAVAILABLE', message: 'The demo API is temporarily unavailable. Please retry.' }, { status: 503 });
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
