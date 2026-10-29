/** Run only against a disposable demo environment: this suite resets shared data. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prefill } from '../lib/prefill.ts';
import type { Application, DemoUser, Snapshot } from '../lib/types.ts';

const base = process.env.TEST_BASE_URL;
const enabled = !!base && process.env.ALLOW_DEMO_RESET === '1';
test('persistent grant journey, permissions, upload verification and concurrent funding decisions', { skip: !enabled }, async () => {
  async function request(actor: string, path: string, body?: Record<string, unknown>, method?: string) {
    const response = await fetch(`${base}/api/${path}`, { method: method || (body ? 'POST' : 'GET'), headers: {
      'x-demo-user': actor, ...(body ? { 'Content-Type': 'application/json' } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (response.status >= 500) console.error('API failure', path, response.status, data.message);
    return { status: response.status, data };
  }
  const users: DemoUser[] = (await request('', 'demo-users')).data;
  const [admin, reviewer] = users.filter(u => u.role === 'admin');
  const [first, second] = users.filter(u => u.role === 'applicant');
  assert.ok(admin && reviewer && first && second);
  const before: Snapshot = (await request(admin.id, 'snapshot')).data;
  assert.equal((await request(admin.id, 'demo/reset', { generation: before.generation, confirmation: 'RESET' })).status, 200);
  let snap: Snapshot = (await request(admin.id, 'snapshot')).data;
  const generation = snap.generation;
  assert.equal(generation, before.generation + 1);
  assert.equal((await request(admin.id, 'demo/reset', { generation: before.generation, confirmation: 'RESET' })).status, 409);
  const initial: Snapshot = (await request(first.id, 'snapshot')).data;
  assert.ok(initial.grants.every(g => !('budget_cents' in g) && !('committed_cents' in g)));
  assert.ok(initial.applications.every(a => a.applicant_id === first.id && !('internal_note' in a)));
  assert.ok(snap.applications.some(a => a.status === 'Approved'));
  assert.ok(snap.applications.some(a => a.status === 'Rejected'));
  const sampleDoc = snap.applications[0].documents[0];
  const sampleDownload = await request(admin.id, `documents/${sampleDoc.id}/download`);
  assert.equal(sampleDownload.status, 200);
  assert.equal((await fetch(sampleDownload.data.url)).status, 200, 'Run seed:storage before this suite');
  const created = await request(admin.id, 'grants', { generation, ...prefill, budget_cents: 10_000_000, reviewer_id: reviewer.id, status: 'Open' });
  assert.equal(created.status, 200);
  const grantId = created.data.id;
  const newGrant = (await request(admin.id, `grants/${grantId}`)).data;
  assert.equal(newGrant.applicant_count, 0); assert.equal(newGrant.committed_cents, 0);
  const samples = new Map<string, Uint8Array>();
  for (const requirement of prefill.requirements) samples.set(requirement.id, await readFile(new URL(`../supabase/fixtures/${requirement.id}.pdf`, import.meta.url)));
  async function apply(applicant: DemoUser, requested_cents: number) {
    const upload_ids: string[] = [];
    for (const requirement of prefill.requirements) {
      const bytes = samples.get(requirement.id)!;
      const intent = await request(applicant.id, 'uploads', { generation, grant_id: grantId, revision: 1, requirement_id: requirement.id, filename: `${requirement.id}.pdf`, mime: 'application/pdf', size_bytes: bytes.byteLength });
      assert.equal(intent.status, 200);
      assert.ok((await fetch(intent.data.url, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: new Blob([new Uint8Array(bytes)]) })).ok);
      assert.equal((await request(applicant.id, `uploads/${intent.data.id}/complete`, { generation })).status, 200);
      upload_ids.push(intent.data.id);
    }
    const payload = { generation, name: applicant.display_name, email: 'synthetic@example.org', requested_cents, revision: 1, submission_key: crypto.randomUUID(), upload_ids };
    const submitted = await request(applicant.id, `grants/${grantId}/applications`, payload);
    assert.equal(submitted.status, 200);
    const duplicate = await request(applicant.id, `grants/${grantId}/applications`, payload);
    assert.equal(duplicate.status, 200); assert.equal(duplicate.data.id, submitted.data.id);
    assert.equal((await request(applicant.id, `grants/${grantId}/applications`, { ...payload, requested_cents: 1 })).status, 409);
    return submitted.data.id as string;
  }
  const bad = await request(first.id, 'uploads', { generation, grant_id: grantId, revision: 1, requirement_id: 'proposal', filename: 'fake.pdf', mime: 'application/pdf', size_bytes: 5 });
  assert.equal(bad.status, 200);
  await fetch(bad.data.url, { method: 'PUT', body: 'wrong', headers: { 'Content-Type': 'application/pdf' } });
  assert.equal((await request(first.id, `uploads/${bad.data.id}/complete`, { generation })).status, 422);
  assert.equal((await request(first.id, `grants/${grantId}/applications`, { generation, name: 'Sample', email: 'sample@example.org', requested_cents: 1, revision: 1, submission_key: crypto.randomUUID(), upload_ids: [bad.data.id] })).status, 422);
  const a = await apply(first, 7_000_000), b = await apply(second, 5_000_000);
  assert.equal((await request(first.id, `applications/${b}`)).status, 404);
  assert.equal((await request(first.id, `applications/${a}/decision`, { generation, decision: 'Rejected' })).status, 404);
  assert.equal((await request(reviewer.id, `applications/${a}`)).data.status, 'Unreviewed', 'Opening a record cannot mark it reviewed');
  const results = await Promise.all([
    request(admin.id, `applications/${a}/decision`, { generation, decision: 'Approved', award_cents: 7_000_000, internal_note: 'Hidden from applicants' }),
    request(reviewer.id, `applications/${b}/decision`, { generation, decision: 'Approved', award_cents: 5_000_000 }),
  ]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 422], 'Concurrent approvals must not overspend');
  const winner = results[0].status === 200 ? a : b, loser = winner === a ? b : a, awarded = winner === a ? 7_000_000 : 5_000_000;
  assert.equal((await request(reviewer.id, `applications/${winner}/decision`, { generation, decision: 'Approved', award_cents: awarded })).status, 200);
  assert.equal((await request(reviewer.id, `applications/${winner}/decision`, { generation, decision: 'Rejected' })).status, 409);
  const financial = (await request(admin.id, `grants/${grantId}`)).data;
  assert.equal(financial.committed_cents, awarded); assert.equal(financial.distributed_cents, awarded / 4);
  assert.equal(financial.available_cents, 10_000_000 - awarded);
  assert.equal((await request(admin.id, `grants/${grantId}`, { generation, ...prefill, revision: 1, budget_cents: awarded - 1, reviewer_id: reviewer.id }, 'PATCH')).status, 422);
  assert.equal((await request(reviewer.id, `applications/${loser}/decision`, { generation, decision: 'Rejected' })).status, 200);
  assert.equal((await request(admin.id, `grants/${grantId}`)).data.committed_cents, awarded);
  assert.equal((await request(admin.id, `grants/${grantId}/close`, { generation, revision: 1 })).status, 200);
  assert.equal((await request(first.id, `grants/${grantId}`)).data.status, 'Closed');
  const own: Application = (await request(winner === a ? first.id : second.id, `applications/${winner}`)).data;
  assert.equal(own.award_cents - own.distributed_cents, awarded * .75);
  assert.ok(!('internal_note' in own));
  // Reassigning a grant must revoke the former reviewer's access immediately.
  assert.equal((await request(admin.id, `grants/${grantId}`, { generation, ...prefill, revision: 2, budget_cents: 10_000_000, reviewer_id: admin.id }, 'PATCH')).status, 200);
  assert.equal((await request(reviewer.id, `applications/${winner}`)).status, 404);
  assert.equal((await request(admin.id, 'demo/reset', { generation, confirmation: 'RESET' })).status, 200);
  assert.equal((await request(admin.id, `applications/${winner}`)).status, 404);
  assert.equal((await request(first.id, `uploads/${bad.data.id}/complete`, { generation })).status, 409);
});
