'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Application, DemoUser, Grant, Snapshot } from '../lib/types';
import { contentType, distribution, MAX_FILE_BYTES, money } from '../lib/rules';
import { prefill } from '../lib/prefill';

const usd = (cents = 0) => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const date = (value: string) => new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please retry.';
const label = (a: Application, admin: boolean) => admin ? a.status : a.status === 'Unreviewed' ? 'Submitted — awaiting decision' : a.status === 'Rejected' ? 'Not awarded' : 'Approved';
type API = <T = unknown>(path: string, body?: Record<string, unknown>, method?: string) => Promise<T>;
type Screen = { kind: 'grants' | 'applications' | 'queue' | 'create' } | { kind: 'grant' | 'edit' | 'apply' | 'application'; id: string };

function ErrorBox({ error }: { error: string }) { return error ? <div className="error" role="alert">{error}</div> : null; }
function Empty({ children, action, onAction }: { children: ReactNode; action?: string; onAction?: () => void }) {
  return <div className="empty"><p>{children}</p>{action && <button className="secondary" onClick={onAction}>{action}</button>}</div>;
}
function Badge({ status, children }: { status: string; children?: ReactNode }) { return <span className={`badge ${status}`}>{children || status}</span>; }
function Metrics({ items }: { items: [string, string | number][] }) {
  return <dl className="metric-grid">{items.map(([name, value]) => <div className="metric" key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>;
}
function Confirm({ title, children, busy, error, action, danger, onConfirm, onCancel }: {
  title: string; children: ReactNode; busy: boolean; error: string; action: string; danger?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => { dialog?.close(); }; }, []);
  return <dialog ref={ref} aria-labelledby="confirm-title" onCancel={e => { e.preventDefault(); if (!busy) onCancel(); }}>
    <h2 id="confirm-title">{title}</h2>{children}<ErrorBox error={error} />
    <div className="actions"><button className="secondary" disabled={busy} onClick={onCancel}>Cancel</button><button className={danger ? 'danger' : ''} disabled={busy} onClick={onConfirm}>{busy ? 'Saving…' : action}</button></div>
  </dialog>;
}

export default function Home() {
  const [users, setUsers] = useState<DemoUser[]>([]), [actor, setActor] = useState('');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null), [screen, setScreen] = useState<Screen>({ kind: 'grants' });
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [loading, setLoading] = useState(true);
  const [reset, setReset] = useState(false), [resetBusy, setResetBusy] = useState(false), [resetError, setResetError] = useState('');
  const actorRef = useRef(''), requestCounter = useRef(0);
  const user = users.find(u => u.id === actor), admin = user?.role === 'admin';
  const api: API = useCallback(async <T,>(path: string, body?: Record<string, unknown>, method?: string): Promise<T> => {
    if (actorRef.current !== actor) throw new Error('Identity changed. Please retry.');
    const response = await fetch(`/api/${path}`, { method: method || (body ? 'POST' : 'GET'), cache: 'no-store',
      headers: { 'x-demo-user': actor, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    if (actorRef.current !== actor) throw new Error('Identity changed. Please retry.');
    if (!response.ok) throw new Error(data.message || 'Request failed. Please retry.');
    return data as T;
  }, [actor]);
  const refresh = useCallback(async () => {
    const request = ++requestCounter.current;
    const data = await api<Snapshot>('snapshot');
    if (request === requestCounter.current) setSnapshot(data);
  }, [api]);
  const loadUsers = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/demo-users', { cache: 'no-store' }); const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load demo identities.');
      if (!data.length) throw new Error('No demo users found. Apply the database migrations.');
      setUsers(data); actorRef.current = data[0].id; setActor(data[0].id);
    } catch (e) { setError(message(e)); setLoading(false); }
  }, []);
  useEffect(() => { void loadUsers(); }, [loadUsers]);
  useEffect(() => {
    if (!actor) return;
    let active = true; setLoading(true);
    refresh().catch(e => { if (active) setError(message(e)); }).finally(() => { if (active) setLoading(false); });
    const focus = () => { refresh().catch(e => { if (active) setError(message(e)); }); };
    window.addEventListener('focus', focus);
    return () => { active = false; window.removeEventListener('focus', focus); };
  }, [actor, refresh]);
  function switchUser(id: string) {
    actorRef.current = id; requestCounter.current++; setActor(id); setSnapshot(null); setError(''); setNotice('');
    setScreen({ kind: 'grants' }); setReset(false); setResetError('');
  }
  async function done(next: Screen, text: string) { await refresh(); setScreen(next); setNotice(text); setError(''); }
  const nav = (next: Screen) => { setScreen(next); setNotice(''); setError(''); void refresh().catch(e => setError(message(e))); };
  const grant = 'id' in screen ? snapshot?.grants.find(g => g.id === screen.id) : undefined;
  const application = screen.kind === 'application' ? snapshot?.applications.find(a => a.id === screen.id) : undefined;
  return <>
    <div className="banner">Demo mode — no authentication. Use sample data only.</div>
    <header className="topbar"><div className="brand">Civic<span>Grants</span> <small> / demo</small></div>
      {user && <div className="identity"><label>Mode<select aria-label="Mode" value={user.role} disabled={resetBusy} onChange={e => { const u = users.find(u => u.role === e.target.value); if (u) switchUser(u.id); }}><option value="admin">Admin</option><option value="applicant">Applicant</option></select></label>
        <label>Demo user<select aria-label="Demo user" value={actor} disabled={resetBusy} onChange={e => switchUser(e.target.value)}>{users.filter(u => u.role === user.role).map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}</select></label></div>}
    </header>
    <main className="shell">
      {user && <nav className="nav" aria-label="Main navigation"><button className={`secondary ${screen.kind === 'grants' ? 'active' : ''}`} onClick={() => nav({ kind: 'grants' })}>{admin ? 'Grants' : 'Browse grants'}</button>
        <button className={`secondary ${['applications', 'queue'].includes(screen.kind) ? 'active' : ''}`} onClick={() => nav({ kind: admin ? 'queue' : 'applications' })}>{admin ? 'Review queue' : 'My Applications'}</button>
        <button className="secondary push" onClick={() => { setError(''); void refresh().catch(e => setError(message(e))); }}>Refresh</button>
        {admin && <button className="link small" onClick={() => { setResetError(''); setReset(true); }}>Reset demo</button>}</nav>}
      <ErrorBox error={error} />{error && <button className="secondary" onClick={() => { if (!actor) void loadUsers(); else { setError(''); void refresh().catch(e => setError(message(e))); } }}>Retry connection</button>}
      <div className="status-message" role="status">{notice}</div>
      {loading ? <div className="loading" role="status">Loading demo…</div> : snapshot && user ? <div key={`${actor}-${snapshot.generation}`}>
        {screen.kind === 'grants' && <Catalog snapshot={snapshot} user={user} navigate={nav} />}
        {(screen.kind === 'applications' || screen.kind === 'queue') && <Applications snapshot={snapshot} admin={!!admin} navigate={nav} />}
        {(screen.kind === 'create' || screen.kind === 'edit') && <GrantForm key={screen.kind === 'edit' ? screen.id : 'new'} grant={grant} users={users} actor={actor} generation={snapshot.generation} api={api} onCancel={() => nav(grant ? { kind: 'grant', id: grant.id } : { kind: 'grants' })} onDone={done} />}
        {screen.kind === 'grant' && (grant ? <GrantDetail grant={grant} snapshot={snapshot} user={user} users={users} api={api} navigate={nav} done={done} /> : <Empty action="View all grants" onAction={() => nav({ kind: 'grants' })}>This grant is no longer available. It may have been reset.</Empty>)}
        {screen.kind === 'apply' && (grant ? <ApplyForm key={grant.id} grant={grant} snapshot={snapshot} user={user} api={api} done={done} refresh={refresh} cancel={() => nav({ kind: 'grant', id: grant.id })} /> : <Empty action="Browse grants" onAction={() => nav({ kind: 'grants' })}>This grant is no longer available.</Empty>)}
        {screen.kind === 'application' && (application ? <ApplicationDetail key={application.id} application={application} snapshot={snapshot} user={user} users={users} api={api} done={done} navigate={nav} /> : <Empty action={admin ? 'View review queue' : 'My Applications'} onAction={() => nav({ kind: admin ? 'queue' : 'applications' })}>This application is no longer available.</Empty>)}
      </div> : !error && <Empty>Connect Supabase to load the demo.</Empty>}
      <div className="actions small" style={{ marginTop: 40 }}><a href="https://github.com/tangledlight/grants-management/blob/main/docs/grants-demo-prd.md" target="_blank" rel="noreferrer">Product requirements</a><a href="https://github.com/tangledlight/grants-management/blob/main/docs/grants-demo-technical-design.md" target="_blank" rel="noreferrer">Technical design</a><a href="https://github.com/tangledlight/grants-management" target="_blank" rel="noreferrer">Repository &amp; review guide</a></div><p className="footer-note">Fictional demo. Distributions are simulated; no money moves. Changes are shared across visitors, and reset restores the shared sample dataset.</p>
    </main>
    {reset && snapshot && <Confirm title="Reset the shared demo?" busy={resetBusy} error={resetError} action="Reset demo" danger onCancel={() => setReset(false)} onConfirm={async () => {
      setResetBusy(true); setResetError('');
      try { await api('demo/reset', { generation: snapshot.generation, confirmation: 'RESET' }); await done({ kind: 'grants' }, 'Demo reset. The sample data has been restored for everyone.'); setReset(false); }
      catch (e) { setResetError(message(e)); } finally { setResetBusy(false); }
    }}><p>This removes submitted demo changes and restores the baseline grants, applications, and decisions for <strong>everyone</strong>.</p></Confirm>}
  </>;
}

function Catalog({ snapshot, user, navigate }: { snapshot: Snapshot; user: DemoUser; navigate: (screen: Screen) => void }) {
  const admin = user.role === 'admin'; const [filter, setFilter] = useState('all'), [query, setQuery] = useState('');
  const base = snapshot.grants.filter(g => admin || g.status === 'Open');
  const filtered = base.filter(g => (filter !== 'created' || g.creator_id === user.id) && (filter !== 'assigned' || g.reviewer_id === user.id));
  const grants = filtered.filter(g => g.title.toLowerCase().includes(query.toLowerCase()));
  const total = (field: 'budget_cents' | 'committed_cents' | 'distributed_cents' | 'applicant_count' | 'unreviewed_count') => grants.reduce((n, g) => n + (g[field] || 0), 0);
  const empty = query ? 'No grants match your search. Try another keyword.' : !admin ? 'No grants are open right now. Check back for new opportunities.' : filter === 'created' ? 'You haven’t created any grants yet.' : filter === 'assigned' ? 'No grants are assigned to you.' : 'No grants yet. Create a grant to start accepting applications.';
  return <section><div className="row"><div><div className="eyebrow">{admin ? 'Funding administration' : 'Community opportunities'}</div><h1>{admin ? 'Your funding, in focus.' : 'Build something for your community.'}</h1><p className="muted">{admin ? 'Publish opportunities, review evidence, and keep every award within budget.' : 'Explore open opportunities and find the right support for your project.'}</p></div>{admin && <button onClick={() => navigate({ kind: 'create' })}>Create grant</button>}</div>
    {admin && <Metrics items={[[`${grants.length} grants · budget`, usd(total('budget_cents'))], ['Committed awards', usd(total('committed_cents'))], ['Distributed (simulated)', usd(total('distributed_cents'))], ['Applicants', total('applicant_count')], ['Unreviewed', total('unreviewed_count')]]} />}
    <div className="toolbar">{admin && <div className="tabs" aria-label="Grant filters">{[['all', 'All Grants'], ['created', 'Created by me'], ['assigned', 'Assigned to me']].map(([v, name]) => <button key={v} className={filter === v ? '' : 'secondary'} aria-pressed={filter === v} onClick={() => setFilter(v)}>{name}</button>)}</div>}<input aria-label="Search grant titles" type="search" placeholder="Search grant titles…" value={query} onChange={e => setQuery(e.target.value)} /></div>
    {!grants.length ? <Empty action={query ? 'Clear search' : admin ? filter === 'assigned' ? 'View all grants' : 'Create grant' : undefined} onAction={() => query ? setQuery('') : filter === 'assigned' ? setFilter('all') : navigate({ kind: 'create' })}>{empty}</Empty> : <div className="grid">{grants.map(g => <article className="card" key={g.id}><Badge status={g.status} /><h2 style={{ marginTop: 16 }}>{g.title}</h2><p className="muted">{g.description}</p>{admin && <><p className="small"><strong>{g.applicant_count}</strong> applicants · <strong>{g.unreviewed_count}</strong> unreviewed</p><p className="small">Budget {usd(g.budget_cents)} · Committed {usd(g.committed_cents)}<br />Distributed (simulated) {usd(g.distributed_cents)}</p></>}<button className="secondary" onClick={() => navigate({ kind: 'grant', id: g.id })}>View grant</button>{!admin && g.unavailable_reason === 'Fully allocated' && <p className="muted small" style={{ marginTop: 12 }}>Fully allocated</p>}</article>)}</div>}
    {admin && <section className="card"><div className="row"><h2>Unreviewed queue</h2><button className="link" onClick={() => navigate({ kind: 'queue' })}>View review queue</button></div><ApplicationTable applications={snapshot.applications.filter(a => a.status === 'Unreviewed' && grants.some(g => g.id === a.grant_id))} admin navigate={navigate} empty="You’re all caught up. No applications need your decision." /></section>}
  </section>;
}

function ApplicationTable({ applications, admin, navigate, empty }: { applications: Application[]; admin: boolean; navigate: (screen: Screen) => void; empty: string }) {
  if (!applications.length) return <Empty>{empty}</Empty>;
  return <div className="table-wrap"><table><thead><tr><th>{admin ? 'Applicant / grant' : 'Grant'}</th><th>Submitted</th><th>Status</th><th>Requested</th><th>Award</th><th>Distributed (simulated)</th></tr></thead><tbody>{applications.map(a => <tr key={a.id}><td><button className="link" onClick={() => navigate({ kind: 'application', id: a.id })}>{admin ? a.name : a.snapshot.title}</button>{admin && <div className="muted small">{a.snapshot.title}</div>}</td><td className="small">{date(a.submitted_at)}</td><td><Badge status={a.status}>{label(a, admin)}</Badge></td><td className="money">{usd(a.requested_cents)}</td><td className="money">{a.status === 'Approved' ? usd(a.award_cents) : '—'}</td><td className="money">{a.status === 'Approved' ? usd(a.distributed_cents) : '—'}</td></tr>)}</tbody></table></div>;
}
function Applications({ snapshot, admin, navigate }: { snapshot: Snapshot; admin: boolean; navigate: (screen: Screen) => void }) {
  const apps = admin ? snapshot.applications.filter(a => a.status === 'Unreviewed') : snapshot.applications;
  return <section><div className="eyebrow">{admin ? 'Decisions to make' : 'Your funding journey'}</div><h1>{admin ? 'Review queue' : 'My Applications'}</h1><p className="muted">{admin ? 'Applications for grants you created or are assigned to review.' : 'Track your submissions, decisions, and simulated awards.'}</p>
    {!apps.length ? <Empty action={admin ? undefined : 'Browse grants'} onAction={() => navigate({ kind: 'grants' })}>{admin ? 'You’re all caught up. No applications need your decision.' : 'You haven’t submitted any applications yet. Explore open grants to get started.'}</Empty> : <div className="card"><ApplicationTable applications={apps} admin={admin} navigate={navigate} empty="" /></div>}
    {!admin && !apps.some(a => a.status === 'Approved') && <Empty>No grants awarded yet. Your award details will appear here after approval.</Empty>}
  </section>;
}

function GrantForm({ grant, users, actor, generation, api, onCancel, onDone }: {
  grant?: Grant; users: DemoUser[]; actor: string; generation: number; api: API; onCancel: () => void; onDone: (next: Screen, text: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(grant?.title || prefill.title), [description, setDescription] = useState(grant?.description || prefill.description);
  const [eligibility, setEligibility] = useState(grant?.eligibility || prefill.eligibility), [budget, setBudget] = useState(grant ? ((grant.budget_cents || 0) / 100).toFixed(2) : prefill.budget);
  const [requirements, setRequirements] = useState(grant?.requirements || prefill.requirements.map(r => ({ ...r })));
  const [reviewer, setReviewer] = useState(grant?.reviewer_id || actor), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [revision] = useState(grant?.revision);
  async function save(status: 'Draft' | 'Open') {
    setBusy(true); setError('');
    try {
      if (!title.trim() || !description.trim() || !eligibility.trim() || !requirements.length || requirements.some(r => !r.description.trim())) throw new Error('Complete all required grant fields and document descriptions.');
      const budget_cents = money(budget);
      if (grant && budget_cents < (grant.committed_cents || 0)) throw new Error('Budget cannot fall below committed awards.');
      const saved = await api<{ id: string }>(grant ? `grants/${grant.id}` : 'grants', { generation, title, description, eligibility, requirements, budget_cents, reviewer_id: reviewer, ...(grant ? { revision } : { status }) }, grant ? 'PATCH' : 'POST');
      await onDone({ kind: 'grant', id: saved.id }, grant ? 'Grant changes saved.' : status === 'Open' ? 'Grant published. Applicants can now discover it.' : 'Draft saved. Only admins can see it.');
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <section className="form-limit"><button className="link back" disabled={busy} onClick={onCancel}>← Back</button><div className="eyebrow">Grant setup</div><h1>{grant ? 'Edit grant' : 'Create a grant'}</h1>
    {!grant && <div className="notice warning">Sample grant — edit before publishing</div>}
    <p className="muted">{grant ? 'Changes apply to future submissions. Submitted evidence keeps its original requirements.' : 'All fields are editable. Nothing is saved until you choose Save draft or Publish.'}</p>
    <form className="card" onSubmit={(e: FormEvent) => { e.preventDefault(); void save('Draft'); }}>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
        <label className="field"><span>Title *</span><input required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} /></label>
        <label className="field"><span>Description *</span><textarea required maxLength={20000} value={description} onChange={e => setDescription(e.target.value)} /></label>
        <label className="field"><span>Eligibility requirements *</span><textarea required maxLength={20000} value={eligibility} onChange={e => setEligibility(e.target.value)} /></label>
        <div className="form-grid"><label className="field"><span>Total funding budget (USD) *</span><input required inputMode="decimal" value={budget} onChange={e => setBudget(e.target.value)} /><small>Zero is allowed. Minimum: {usd(grant?.committed_cents)} committed.</small></label>
          <label className="field"><span>Assigned reviewer *</span><select aria-label="Assigned reviewer" value={reviewer} onChange={e => setReviewer(e.target.value)}>{users.filter(u => u.role === 'admin').map(u => <option key={u.id} value={u.id}>{u.display_name}{u.id === actor ? ' (you)' : ''}</option>)}</select></label></div>
        <h3>Required documents *</h3>{requirements.map((r, index) => <label className="field" key={r.id}><span>Document {index + 1}</span><div className="remove-row"><textarea required maxLength={4000} value={r.description} onChange={e => setRequirements(old => old.map(item => item.id === r.id ? { ...item, description: e.target.value } : item))} /><button type="button" className="secondary" aria-label={`Remove document ${index + 1}`} disabled={requirements.length === 1} onClick={() => setRequirements(old => old.filter(item => item.id !== r.id))}>Remove</button></div></label>)}
        <button type="button" className="secondary" disabled={requirements.length >= 20} onClick={() => setRequirements(old => [...old, { id: crypto.randomUUID(), description: '' }])}>Add document requirement</button>
        <ErrorBox error={error} /><hr className="divider" /><div className="actions"><button type="submit">{busy ? 'Saving…' : grant ? 'Save changes' : 'Save draft'}</button>{!grant && <button type="button" onClick={() => void save('Open')}>Publish</button>}<button type="button" className="secondary" onClick={onCancel}>Cancel</button></div>
      </fieldset>
    </form>
  </section>;
}

function GrantDetail({ grant: g, snapshot, user, users, api, navigate, done }: {
  grant: Grant; snapshot: Snapshot; user: DemoUser; users: DemoUser[]; api: API; navigate: (screen: Screen) => void; done: (next: Screen, text: string) => Promise<void>;
}) {
  const admin = user.role === 'admin', creator = admin && g.creator_id === user.id, review = admin && [g.creator_id, g.reviewer_id].includes(user.id);
  const [status, setStatus] = useState('all'), [confirm, setConfirm] = useState<'publish' | 'close' | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const all = snapshot.applications.filter(a => a.grant_id === g.id), apps = all.filter(a => status === 'all' || a.status === status), own = all.find(a => a.applicant_id === user.id);
  return <section><button className="link back" onClick={() => navigate({ kind: 'grants' })}>← {admin ? 'All grants' : 'Browse grants'}</button><div className="row"><div><Badge status={g.status} /><h1 style={{ marginTop: 14 }}>{g.title}</h1></div><div className="actions">{creator && <><button className="secondary" onClick={() => navigate({ kind: 'edit', id: g.id })}>Edit grant</button>{g.status !== 'Closed' && <button onClick={() => { setError(''); setConfirm(g.status === 'Draft' ? 'publish' : 'close'); }}>{g.status === 'Draft' ? 'Publish grant' : 'Close grant'}</button>}</>}
      {!admin && (own ? <button onClick={() => navigate({ kind: 'application', id: own.id })}>View application</button> : <button disabled={!g.accepts_applications} onClick={() => navigate({ kind: 'apply', id: g.id })}>{g.accepts_applications ? 'Apply' : g.unavailable_reason}</button>)}</div></div>
    {admin && <><p className="muted">Created by {users.find(u => u.id === g.creator_id)?.display_name} · Reviewer: {users.find(u => u.id === g.reviewer_id)?.display_name}</p><Metrics items={[
      ['Total funding budget', usd(g.budget_cents)], ['Available to award', usd(g.available_cents)], ['Committed awards', usd(g.committed_cents)], ['Distributed (simulated)', usd(g.distributed_cents)], ['Committed but undistributed', usd(g.undistributed_cents)],
    ]} /></>}
    <div className="card"><h2>About this grant</h2><p className="prose">{g.description}</p><h3>Eligibility requirements</h3><p className="prose">{g.eligibility}</p><h3>Required documents</h3><ul className="requirements">{g.requirements.map(r => <li key={r.id}>{r.description}</li>)}</ul></div>
    {admin && review && <section className="card"><div className="row"><h2>Applications <small>({all.length})</small></h2><label>Status<select aria-label="Filter applications by status" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option><option>Unreviewed</option><option>Approved</option><option>Rejected</option></select></label></div>
      {!apps.length && all.length ? <Empty action="Clear filter" onAction={() => setStatus('all')}>No applications match this status.</Empty> : <ApplicationTable applications={apps} admin navigate={navigate} empty="No applications yet. Submitted applications will appear here." />}
      {!(g.committed_cents || 0) && <Empty>No awards yet. Approve an application to allocate funding.</Empty>}
    </section>}
    {admin && !review && <div className="notice">Application details are available to this grant’s creator and assigned reviewer.</div>}
    {!admin && own && <div className="notice">You have already submitted an application. Submissions cannot be edited, withdrawn, or resubmitted.</div>}
    {confirm && <Confirm title={confirm === 'publish' ? 'Publish this grant?' : 'Close this grant?'} busy={busy} error={error} action={confirm === 'publish' ? 'Publish grant' : 'Close grant'} onCancel={() => setConfirm(null)} onConfirm={async () => {
      setBusy(true); setError(''); try { await api(`grants/${g.id}/${confirm}`, { generation: snapshot.generation, revision: g.revision }); await done({ kind: 'grant', id: g.id }, confirm === 'publish' ? 'Grant published.' : 'Grant closed. Existing applications can still receive decisions.'); setConfirm(null); } catch (e) { setError(message(e)); } finally { setBusy(false); }
    }}><p>{confirm === 'publish' ? 'This makes the opportunity discoverable to applicants. New grants begin with zero applicants, awards, and distributions.' : 'New applications will be blocked. Existing applications remain reviewable. A closed grant cannot be reopened in this demo.'}</p></Confirm>}
  </section>;
}

type StagedFile = { localId: string; requirementId: string; filename: string; status: 'uploading' | 'ready' | 'failed'; uploadId?: string; error?: string };
function ApplyForm({ grant: g, snapshot, user, api, done, refresh, cancel }: {
  grant: Grant; snapshot: Snapshot; user: DemoUser; api: API; done: (next: Screen, text: string) => Promise<void>; refresh: () => Promise<void>; cancel: () => void;
}) {
  const [name, setName] = useState(user.display_name), [email, setEmail] = useState(''), [requested, setRequested] = useState('');
  const [revision, setRevision] = useState(g.revision), [requirements, setRequirements] = useState(g.requirements);
  const [files, setFiles] = useState<StagedFile[]>([]), [submissionKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const stale = revision !== g.revision, uploading = files.some(f => f.status === 'uploading');
  const existing = snapshot.applications.find(a => a.grant_id === g.id && a.applicant_id === user.id);
  const fileInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function upload(requirementId: string, selected: FileList | null) {
    if (!selected) return;
    for (const file of Array.from(selected)) {
      const localId = crypto.randomUUID();
      setFiles(old => [...old, { localId, requirementId, filename: file.name, status: 'uploading' }]);
      try {
        if (!file.size || file.size > MAX_FILE_BYTES) throw new Error('Choose a file between 1 byte and 10 MB.');
        const mime = contentType(new Uint8Array(await file.slice(0, 8).arrayBuffer()));
        if (!mime || !/\.(pdf|jpe?g|png)$/i.test(file.name)) throw new Error('Choose a PDF, JPG or PNG file.');
        const intent = await api<{ id: string; url: string }>('uploads', { generation: snapshot.generation, grant_id: g.id, revision, requirement_id: requirementId, filename: file.name, mime, size_bytes: file.size });
        const response = await fetch(intent.url, { method: 'PUT', body: file, headers: { 'Content-Type': mime, 'x-upsert': 'false' } });
        if (!response.ok) throw new Error('Upload failed. Remove this file and choose it again to retry.');
        await api(`uploads/${intent.id}/complete`, { generation: snapshot.generation });
        if (mounted.current) setFiles(old => old.map(f => f.localId === localId ? { ...f, uploadId: intent.id, status: 'ready' } : f));
      } catch (e) { if (mounted.current) setFiles(old => old.map(f => f.localId === localId ? { ...f, status: 'failed', error: message(e) } : f)); }
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (stale) throw new Error('Review the updated grant requirements before submitting.');
      if (uploading || files.some(f => f.status === 'failed')) throw new Error('Wait for uploads to finish and remove or retry failed files.');
      if (!requirements.every(r => files.some(f => f.requirementId === r.id && f.status === 'ready'))) throw new Error('Upload at least one qualifying document for every requirement.');
      const requested_cents = money(requested); if (requested_cents <= 0) throw new Error('Requested funding must be positive.');
      const saved = await api<{ id: string }>(`grants/${g.id}/applications`, { generation: snapshot.generation, name, email, requested_cents, revision, submission_key: submissionKey, upload_ids: files.filter(f => f.status === 'ready').map(f => f.uploadId) });
      await done({ kind: 'application', id: saved.id }, 'Application submitted. Your complete submission is now available for review.');
    } catch (e) { setError(message(e)); void refresh().catch(() => {}); } finally { setBusy(false); }
  }
  if (existing) return <Empty action="View application" onAction={() => void done({ kind: 'application', id: existing.id }, '')}>You have already submitted an application for this grant.</Empty>;
  return <section className="form-limit"><button className="link back" disabled={busy} onClick={cancel}>← Grant details</button><div className="eyebrow">Application</div><h1>{g.title}</h1><p className="muted">Your submission is final. Add sample evidence for every requirement before submitting.</p>
    {!g.accepts_applications && <div className="notice warning">This grant is no longer accepting applications. {g.unavailable_reason}</div>}
    {stale && <div className="notice warning"><p>The grant changed while you were preparing your application. Your name, email and requested amount are preserved. Review the new requirements and re-upload evidence.</p><ul>{g.requirements.map(r => <li key={r.id}>{r.description}</li>)}</ul><button disabled={uploading || busy} onClick={() => { setRequirements(g.requirements); setRevision(g.revision); setFiles([]); setError(''); }}>Use updated requirements</button></div>}
    <form className="card" onSubmit={submit}><fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}><div className="form-grid"><label className="field"><span>Name *</span><input required maxLength={200} autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></label><label className="field"><span>Email *</span><input required type="email" maxLength={254} autoComplete="email" placeholder="you@example.org" value={email} onChange={e => setEmail(e.target.value)} /></label></div>
      <label className="field"><span>Requested funding (USD) *</span><input required inputMode="decimal" placeholder="20000.00" value={requested} onChange={e => setRequested(e.target.value)} /></label><hr className="divider" /><h2>Qualifying documents</h2><p className="muted small">PDF, JPG or PNG · maximum 10 MB per file · multiple files allowed per requirement.</p>
      {!files.length && <div className="notice"><p>No documents uploaded. Add the required files before submitting.</p><button type="button" className="secondary" onClick={() => fileInput.current?.click()}>Upload documents</button></div>}
      {requirements.map((r, i) => <div className="document" key={r.id}><label className="field"><span>{i + 1}. {r.description} *</span><input ref={i === 0 ? fileInput : undefined} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" disabled={busy || stale || !g.accepts_applications} onChange={e => { void upload(r.id, e.target.files); e.target.value = ''; }} /></label>
        {files.filter(f => f.requirementId === r.id).map(f => <div className="row small" key={f.localId}><p>{f.filename} <span className={f.status === 'failed' ? 'file-error' : 'file-ok'}>{f.status === 'ready' ? '· Uploaded and verified' : f.status === 'uploading' ? '· Uploading…' : `· ${f.error}`}</span></p><button type="button" className="link" disabled={f.status === 'uploading' || busy} onClick={() => setFiles(old => old.filter(item => item.localId !== f.localId))}>Remove</button></div>)}
      </div>)}<ErrorBox error={error} /><div className="actions"><button type="submit" disabled={busy || uploading || stale || !g.accepts_applications}>{busy ? 'Submitting…' : uploading ? 'Uploading evidence…' : 'Submit application'}</button><button type="button" className="secondary" disabled={busy} onClick={cancel}>Cancel</button></div></fieldset></form>
  </section>;
}

function ApplicationDetail({ application: a, snapshot, user, users, api, done, navigate }: {
  application: Application; snapshot: Snapshot; user: DemoUser; users: DemoUser[]; api: API; done: (next: Screen, text: string) => Promise<void>; navigate: (screen: Screen) => void;
}) {
  const admin = user.role === 'admin', g = snapshot.grants.find(g => g.id === a.grant_id);
  const [award, setAward] = useState((a.requested_cents / 100).toFixed(2)), [note, setNote] = useState('');
  const [checked, setChecked] = useState<string[]>([]), [confirm, setConfirm] = useState<'Approved' | 'Rejected' | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [downloadError, setDownloadError] = useState('');
  let amount = 0, amountError = '';
  try { amount = money(award); if (amount <= 0 || amount > a.requested_cents || amount > (g?.available_cents || 0)) amountError = 'Award must be positive and within the requested amount and available funding.'; } catch (e) { amountError = message(e); }
  async function download(id: string) {
    setDownloadError('');
    try { const file = await api<{ url: string }>(`documents/${id}/download`); window.location.assign(file.url); }
    catch (e) { setDownloadError(message(e)); }
  }
  return <section><button className="link back" onClick={() => navigate({ kind: admin ? 'queue' : 'applications' })}>← {admin ? 'Review queue' : 'My Applications'}</button><div className="row"><div><div className="eyebrow">{admin ? 'Application review' : 'Application details'}</div><h1>{a.snapshot.title}</h1><p className="muted">Submitted {date(a.submitted_at)}</p></div><Badge status={a.status}>{label(a, admin)}</Badge></div>
    <Metrics items={a.status === 'Approved' ? [['Requested funding', usd(a.requested_cents)], ['Award amount', usd(a.award_cents)], ['Distributed (simulated)', usd(a.distributed_cents)], ['Remaining award balance', usd(a.award_cents - a.distributed_cents)]] : [['Requested funding', usd(a.requested_cents)]]} />
    {a.status === 'Approved' && <div className="notice">The full award is committed. The initial 25% distribution is simulated; no money has been transferred.</div>}
    <div className="grid"><section className="card"><h2>Submitted information</h2><p><strong>{a.name}</strong><br />{a.email}</p><h3>Grant information at submission</h3><p className="prose">{a.snapshot.description}</p><h3>Eligibility</h3><p className="prose">{a.snapshot.eligibility}</p>{g && <button className="link" onClick={() => navigate({ kind: 'grant', id: g.id })}>View current grant details</button>}</section>
      <section className="card"><h2>Submitted documents</h2><ul className="doc-list">{a.documents.map(d => <li key={d.id}><button className="link" onClick={() => void download(d.id)}>{d.filename}</button><div className="muted small">{a.snapshot.requirements.find(r => r.id === d.requirement_id)?.description}</div></li>)}</ul><ErrorBox error={downloadError} /><p className="muted small">Submitted applications are read-only.</p></section></div>
    {admin && <section className="card"><div className="row"><h2>Review & decision</h2><p className="muted small">Reviewer: {users.find(u => u.id === g?.reviewer_id)?.display_name || 'Unavailable'}</p></div>
      <h3>Manual requirements checklist</h3><p className="muted small">A local review aid. Checking items does not save a review status or change the application’s decision.</p>
      {a.snapshot.requirements.map(r => <label className="check" key={r.id}><input type="checkbox" checked={checked.includes(r.id)} onChange={e => setChecked(old => e.target.checked ? [...old, r.id] : old.filter(id => id !== r.id))} />{r.description}</label>)}
      {a.status === 'Unreviewed' ? <><div className="form-grid"><label className="field"><span>Award amount (USD)</span><input aria-label="Award amount (USD)" inputMode="decimal" value={award} onChange={e => setAward(e.target.value)} /><small>Requested: {usd(a.requested_cents)} · Available: {usd(g?.available_cents)}</small></label><label className="field"><span>Internal note (optional)</span><textarea aria-label="Internal note (optional)" maxLength={4000} value={note} onChange={e => setNote(e.target.value)} /><small>Hidden from applicant views.</small></label></div>
        {amountError && <p className="file-error">{amountError}</p>}<div className="actions"><button disabled={!!amountError} onClick={() => { setError(''); setConfirm('Approved'); }}>Approve application</button><button className="secondary" onClick={() => { setError(''); setConfirm('Rejected'); }}>Reject application</button></div></> : <div className="notice"><p><strong>Decision final:</strong> {a.status} by {users.find(u => u.id === a.decided_by)?.display_name || 'Demo admin'}{a.decided_at ? ` on ${date(a.decided_at)}` : ''}.</p>{a.internal_note && <p className="prose">Internal note: {a.internal_note}</p>}</div>}
    </section>}
    {confirm && <Confirm title={confirm === 'Approved' ? 'Approve this application?' : 'Reject this application?'} busy={busy} error={error} action={confirm === 'Approved' ? 'Approve application' : 'Reject application'} onCancel={() => setConfirm(null)} onConfirm={async () => {
      setBusy(true); setError(''); try {
        if (confirm === 'Approved' && amountError) throw new Error(amountError);
        await api(`applications/${a.id}/decision`, { generation: snapshot.generation, decision: confirm, ...(confirm === 'Approved' ? { award_cents: amount } : {}), internal_note: note });
        await done({ kind: 'application', id: a.id }, confirm === 'Approved' ? 'Application approved. One award and one simulated distribution were recorded.' : 'Application rejected. Funding totals are unchanged.'); setConfirm(null);
      } catch (e) { setError(message(e)); } finally { setBusy(false); }
    }}><p>This decision is final in the demo.</p>{confirm === 'Approved' ? <Metrics items={[[`Award · ${a.name}`, usd(amount)], ['Initial 25% distribution (simulated)', usd(distribution(amount))]]} /> : <p>No award or distribution will be created.</p>}</Confirm>}
  </section>;
}
