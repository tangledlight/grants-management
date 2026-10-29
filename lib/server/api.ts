import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../database.types.ts';
import { z } from 'zod';
import { contentType, MAX_FILE_BYTES } from '../rules.ts';
import type { Snapshot } from '../types.ts';

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid record ID');
const cents = z.number().int().min(0).max(9_000_000_000_000);
const grantInput = z.object({
  title: z.string().trim().min(1).max(200), description: z.string().trim().min(1).max(20000),
  eligibility: z.string().trim().min(1).max(20000),
  requirements: z.array(z.object({ id: z.string().min(1).max(100), description: z.string().trim().min(1).max(4000) })).min(1).max(20)
    .refine(rows => new Set(rows.map(r => r.id)).size === rows.length, 'Document requirement IDs must be unique'),
  budget_cents: cents, reviewer_id: uuid,
});
class ApiError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}
function check<T>(result: { data: T | null; error: { message: string; code?: string } | null }): NonNullable<T> {
  if (result.error) {
    const code = result.error.code;
    console.error('Data operation failed', code || 'unknown');
    if (code === '42501') throw new ApiError('You do not have permission for this action.', 403);
    if (['P0002', 'PGRST116'].includes(code || '')) throw new ApiError('Record unavailable. Refresh and retry.', 404);
    if (['40001', 'PT409', '23505'].includes(code || '')) throw new ApiError(result.error.message, 409);
    if (code === 'P0001') throw new ApiError(result.error.message);
    if (['23514', '23502', '22P02', '22003'].includes(code || '')) throw new ApiError('Check the required fields and amount limits.');
    throw new ApiError('The data service could not complete this request. Please retry.', 503);
  }
  if (result.data === null) throw new ApiError('The data service returned no record. Please retry.', 503);
  return result.data as NonNullable<T>;
}
export async function handleApi(req: Request, client: SupabaseClient<Database>, seedBaseline?: (client: SupabaseClient<Database>) => Promise<void>) {
  const send = (data: unknown) => Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api\//, '').split('/');
    if (req.method === 'GET' && path.join('/') === 'demo-users') {
      return send(check(await client.from('demo_users').select('id,display_name,role').order('display_name')));
    }
    const actor = uuid.parse(req.headers.get('x-demo-user'));
    const userResult = await client.from('demo_users').select('id,role').eq('id', actor).single();
    const user = check(userResult);
    const admin = user.role === 'admin';
    const snapshot = check(await client.rpc('demo_snapshot', { actor })) as Snapshot;
    const { generation, grants, applications } = snapshot;
    if (req.method === 'GET') {
      if (path.join('/') === 'snapshot') return send(snapshot);
      if (path.join('/') === 'state') return send({ generation });
      if (path[0] === 'grants' && path.length <= 2) {
        if (path[1]) {
          const g = grants.find(g => g.id === path[1]);
          if (!g) throw new ApiError('Grant unavailable', 404);
          return send(g);
        }
        const filter = url.searchParams.get('filter');
        const q = (url.searchParams.get('q') || '').toLowerCase();
        return send(grants.filter(g => (admin || g.status === 'Open') && g.title.toLowerCase().includes(q)
          && (!admin || filter !== 'created' || g.creator_id === actor)
          && (!admin || filter !== 'assigned' || g.reviewer_id === actor)));
      }
      if (path[0] === 'applications' && path.length <= 2) {
        if (path[1]) {
          const a = applications.find(a => a.id === path[1]);
          if (!a) throw new ApiError('Application unavailable', 404);
          return send(a);
        }
        const grantId = url.searchParams.get('grant_id'), status = url.searchParams.get('status');
        return send(applications.filter(a => (!grantId || a.grant_id === grantId) && (!status || a.status === status)));
      }
      if (path[0] === 'documents' && path.length === 3 && path[2] === 'download') {
        const id = uuid.parse(path[1]);
        if (!applications.some(a => a.documents.some(d => d.id === id))) throw new ApiError('Document unavailable', 404);
        const docResult = await client.from('documents').select('upload_intents(object_key,filename)').eq('id', id).single();
        const doc = check(docResult);
        const upload = doc.upload_intents as unknown as { object_key: string; filename: string };
        const signed = check(await client.storage.from('evidence').createSignedUrl(upload.object_key, 60, { download: upload.filename }));
        return send({ url: signed.signedUrl });
      }
      throw new ApiError('Endpoint unavailable', 404);
    }
    const body = z.record(z.string(), z.unknown()).parse(await req.json());
    const expected = z.number().int().positive().parse(body.generation);
    if (expected !== generation) throw new ApiError('Dataset changed. Refresh and retry.', 409);
    const mutate = async (operation: string, payload: Record<string, unknown>) => check(await client.rpc('demo_mutate', {
      actor, expected_generation: expected, operation, payload: payload as Json,
    }));
    if (req.method === 'POST' && path.join('/') === 'demo/seed-storage') {
      if (!admin) throw new ApiError('Admin required.', 403);
      if (!seedBaseline) throw new ApiError('Run the storage seed script in local mode.', 503);
      await seedBaseline(client);
      return send({ seeded: 9 });
    }
    if (req.method === 'POST' && path[0] === 'uploads') {
      if (admin) throw new ApiError('Select an applicant to upload documents.', 403);
      if (path.length === 3 && path[2] === 'complete') {
        const intentResult = await client.from('upload_intents').select('*').eq('id', uuid.parse(path[1])).eq('applicant_id', actor).single();
        const intent = check(intentResult);
        if (intent.generation !== generation || intent.consumed || Date.parse(intent.expires_at) < Date.now()) throw new ApiError('Upload expired. Select the file again.', 409);
        const blob = check(await client.storage.from('evidence').download(intent.object_key));
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (bytes.length !== intent.size_bytes || bytes.length > MAX_FILE_BYTES || contentType(bytes) !== intent.mime) {
          throw new ApiError('File contents must match a PDF, JPG or PNG, up to 10 MB. Select a valid file.');
        }
        return send(await mutate('complete_upload', { grant_id: intent.grant_id, revision: intent.revision, upload_id: intent.id }));
      }
      if (path.length !== 1) throw new ApiError('Endpoint unavailable', 404);
      const p = z.object({ grant_id: uuid, revision: z.number().int().positive(), requirement_id: z.string().min(1).max(100),
        filename: z.string().min(1).max(200), mime: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
        size_bytes: z.number().int().positive().max(MAX_FILE_BYTES),
      }).parse(body);
      const intent = await mutate('create_upload', p) as { id: string; object_key: string };
      const signed = check(await client.storage.from('evidence').createSignedUploadUrl(intent.object_key, { upsert: false }));
      return send({ id: intent.id, url: signed.signedUrl });
    }
    let operation = ''; let payload: Record<string, unknown> = {};
    if (path[0] === 'grants') {
      if (req.method === 'POST' && path.length === 1) {
        operation = 'create'; payload = { ...grantInput.parse(body), status: z.enum(['Draft', 'Open']).parse(body.status) };
      }
      if (req.method === 'PATCH' && path.length === 2) {
        operation = 'edit'; payload = { ...grantInput.parse(body), grant_id: uuid.parse(path[1]), revision: z.number().int().positive().parse(body.revision) };
      }
      if (req.method === 'POST' && path.length === 3 && ['publish', 'close'].includes(path[2])) {
        operation = path[2]; payload = { grant_id: uuid.parse(path[1]), revision: z.number().int().positive().parse(body.revision) };
      }
      if (req.method === 'POST' && path.length === 3 && path[2] === 'applications') {
        operation = 'submit'; payload = { ...z.object({ name: z.string().trim().min(1).max(200), email: z.email().max(254),
          requested_cents: cents.refine(n => n > 0, 'Requested funding must be positive'), revision: z.number().int().positive(),
          submission_key: uuid, upload_ids: z.array(uuid).min(1).max(100),
        }).parse(body), grant_id: uuid.parse(path[1]) };
      }
    }
    if (req.method === 'POST' && path.length === 3 && path[0] === 'applications' && path[2] === 'decision') {
      const a = applications.find(a => a.id === path[1]);
      if (!a || !admin) throw new ApiError('Application unavailable', 404);
      operation = 'decision'; payload = { ...z.object({ decision: z.enum(['Approved', 'Rejected']), award_cents: cents.optional(),
        internal_note: z.string().max(4000).optional(),
      }).parse(body), application_id: a.id, grant_id: a.grant_id };
    }
    if (req.method === 'POST' && path.join('/') === 'demo/reset') {
      operation = 'reset'; payload = { confirmation: z.literal('RESET').parse(body.confirmation) };
    }
    if (!operation) throw new ApiError('Endpoint unavailable', 404);
    return send(await mutate(operation, payload));
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ code: 'VALIDATION', message: error.issues.map(i => `${i.path.join('.') || 'Input'}: ${i.message}`).join(' '), fieldErrors: z.flattenError(error) }, { status: 422 });
    if (error instanceof SyntaxError) return Response.json({ code: 'VALIDATION', message: 'Send valid JSON.' }, { status: 400 });
    if (error instanceof ApiError) return Response.json({ code: 'REQUEST_FAILED', message: error.message }, { status: error.status });
    console.error('API request failed', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ code: 'SERVICE_UNAVAILABLE', message: 'Service unavailable. Check the Supabase environment settings and migrations, then retry.' }, { status: 503 });
  }
}
