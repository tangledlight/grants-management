# Development reference

The hosted demo uses Next.js 16 on Vercel, a Supabase Edge Function for the API, and Supabase PostgreSQL/Storage. The browser never receives a database server key. [Implementation notes](implementation.md) describe the deployed boundaries and verification evidence.

## Local app

Use Node.js 22 LTS and install the committed dependency graph:

```sh
npm ci
cp .env.example .env.local
```

For the same behavior as the hosted app, configure `SUPABASE_EDGE_FUNCTION_URL` and `SUPABASE_ANON_KEY` in `.env.local`. The latter is the project's legacy public anon JWT, used to pass the function gateway's JWT check. It is not a service-role key or an authenticated applicant session. Named demo identities are still intentionally selectable by every visitor.

Alternatively, leave the function URL empty and configure `SUPABASE_URL` plus a server-only `SUPABASE_SECRET_KEY` for direct local API execution. This mode uses the same handler and SQL functions. Keep environment files out of Git.

```sh
npm run dev
npm run typecheck
npm test
npm run build
```

The app runs at `http://localhost:3000`. Live mutations and reset affect the configured Supabase dataset, including when the UI is running locally.

## Fresh Supabase environment

Apply `supabase/migrations/001_demo.sql`, followed by `002_snapshot.sql`, once to a new project. They create eight server-only tables, the transactional write function, the consistent snapshot function, four identities, three grants, two applications and a private `evidence` bucket. Existing environments must use reviewed incremental migrations rather than rerunning initial creation.

The Edge Function source is `supabase/functions/grants-api/index.ts`, with its pinned import map in `deno.json`. Deployment includes its relative imports from `lib/`, including generated database types. Keep function gateway JWT verification enabled. Supabase supplies the function's server key through its runtime environment; no server key is needed in the Vercel deployment.

The three fixture PDFs are committed under `supabase/fixtures/`. The function includes an immutable encoding of those same bytes so `POST /api/demo/seed-storage`, with a selected admin identity and current generation, can provision the nine baseline object paths without transferring a server key. The operation never overwrites existing objects. In direct local mode, `npm run seed:storage` provisions them using the server key instead.

Seeded applications are read-only examples of Approved and Rejected states. Neighborhood Community Project Grant is not seeded, so it can be created live; new submissions begin Unreviewed. Reset restores them atomically and reuses their immutable evidence objects.

## Tests

`npm test` runs five unit tests without external services. The integration and browser suites are explicitly destructive to the shared demo dataset; only run them against a disposable sample environment. They reset the sample data after a successful run.

With the app running, set `TEST_BASE_URL` in `.env.local`:

```sh
ALLOW_DEMO_RESET=1 npm run test:integration
npx playwright install chromium
ALLOW_DEMO_RESET=1 npm run test:browser
```

Both write/reset suites are restricted to local UI URLs and must use a disposable backing database. For safe checks of the public deployment, run `npm run test:browser:readonly`; its network guard rejects API mutations.

The API integration suite covers uploads, submission retries, privacy, concurrent approvals, final decisions, funding invariants, closure, reassignment and stale generations. The browser suite covers grant publication, applicant evidence, assigned review, partial approval, applicant balances, private download, reload persistence, mobile layout and reset. Browser system dependencies may also need to be installed on a Linux host.

## API

All endpoints except `GET /api/demo-users` require `x-demo-user: <selected UUID>`. Every write includes the current `generation` from `GET /api/snapshot`. USD values are integer cents.

| Endpoint | Purpose |
| --- | --- |
| GET `/api/demo-users` | Named demo identities |
| GET `/api/snapshot` | Consistent generation and role-filtered records |
| GET `/api/state` | Current dataset generation |
| GET `/api/grants?filter=created\|assigned&q=title` | Catalog or admin summary |
| POST `/api/grants` | Create draft or open grant |
| GET/PATCH `/api/grants/:id` | Read or creator edit, with expected revision |
| POST `/api/grants/:id/publish` or `/close` | Draft → Open → Closed |
| POST `/api/uploads` | Create intent and signed upload URL |
| POST `/api/uploads/:id/complete` | Verify actual file type and size |
| POST `/api/grants/:id/applications` | Final submission with revision, submission_key and ready upload_ids |
| GET `/api/applications` or `/api/applications/:id` | Own records or permitted admin review records |
| POST `/api/applications/:id/decision` | Final approval/rejection and optional internal note |
| GET `/api/documents/:id/download` | Authorized 60-second signed download URL |
| POST `/api/demo/reset` | Confirmed shared reset; confirmation must equal `RESET` |
| POST `/api/demo/seed-storage` | Idempotent baseline evidence provisioning in hosted mode |

File bytes use PUT directly to Supabase's signed upload URL, then completion verifies the stored bytes. Failed verification cannot create a complete submission. A submission key permits retries of the same payload; changed payloads cannot overwrite a final submission.

## Deployment

Vercel's environment contains `SUPABASE_EDGE_FUNCTION_URL` and `SUPABASE_ANON_KEY`. The same source also supports the direct server mode described above. Changing environment variables requires a new deployment. The target runtime is Node.js 22, the install command is `npm ci`, and the build command is `npm run build`.

GitHub Actions checks types, unit tests, fixture metadata and production build. Live integration/browser suites are opt-in so ordinary pushes cannot reset the shared presentation dataset. Production access protection is managed separately by Vercel and is not disabled by application code.

## Maintenance limits

Reset removes database references to previous uploads but does not perform automatic object garbage collection. Keep baseline objects immutable. The application checks supported file signatures; malware scanning, verified user authentication, production retention policy and real payments remain out of scope.
