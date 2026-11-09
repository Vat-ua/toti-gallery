# Regression checks

The goal is quick protection during development, not a full production test platform.

## CI

`.github/workflows/checks.yml` runs on pull requests, pushes to `main`, and manual
requests. It uses Node 22, `npm ci`, lint, TypeScript, the existing non-cloud unit
and transactional integration suites, a Webpack production build, and Chromium
smoke tests at desktop/mobile sizes. A PostgreSQL 18 service container is discarded
with the runner. No GitHub secrets, Neon/Vercel access, OAuth or image credentials
are needed. Fork pull requests can run the same checks. The workflow never deploys.
Playwright publishes failures as GitHub annotations as well as the console log
and downloadable HTML report, so the failing assertion is visible in PR checks.

Commands:

```sh
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run build:smoke
npm run test:smoke
npm run test:sitemap
npm run test:reads
```

The unit suite includes controlled server-streaming checks: unresolved identity
must not block public content, while demo content remains gated by identity.
Rejected public identity also preserves content and suppresses edit/demo controls;
strict private checks still fail closed. Logger checks include multiline-message
injection, source/compiled location filtering, static route labels and response
redaction. Identity-read failures also check that the thrown error has no raw
dependency cause, stays private, preserves framework control flow, and shares its
opaque reference with the HTTP response.
`test:reads` also checks the real Better Auth session/user join, live role/status
changes, revoked sessions and public ownership checks on the isolated database.
Locally, select `GALLERY_IDENTITY_TEST_ENV_FILE` and `GALLERY_READ_TEST_ENV_FILE`
explicitly (both default to `.env.admin-test`); CI uses its disposable loopback DB.

`typecheck` generates Next.js types before running TypeScript. This makes image
imports and route types available in a clean checkout, without starting the
development server or running a full build. Generated files remain ignored.

`test:unit` explicitly selects the existing non-cloud tests. `test:integration`
runs the database suites listed below without repeating their unit companions.
The historical `test:auth` fixture workflow remains separate. `test:sitemap` and
`test:reads` run after smoke setup creates the schema in its disposable database;
their fixtures are rolled back. Add new non-cloud tests to the explicit unit list
rather than globbing every test into CI.

Profile/turma replacement checks include two writers queued behind real row
locks, self-service versus administrative name changes, required HTTP snapshots,
stale avatar compensation and unrelated state changes. Browser scenarios verify
retained drafts on `409`, advancement after a successful save, and an open student
drawer retaining its original snapshot across a server refresh.

## Database integration suites

### Disposable local/CI runner

`npm run test:integration` runs the existing project/account mutations, SQL likes,
admin concurrency, turma/student/moderation/staff operations and public-profile
suites, serially against one fresh database. Transactions, constraints and locks
are real; object storage and selected HTTP/request-context boundaries are controlled.
It does not invoke the legacy OAuth fixture suite or real Google/Neon services.

CI creates `gallery_test_ci_integration` in the existing PostgreSQL service,
separate from the browser smoke database. Local runs require an explicitly
created, empty loopback `gallery_test_*` database and `.env.integration` (or
`GALLERY_INTEGRATION_ENV_FILE`) with this shape:

```dotenv
GALLERY_DATABASE_ENV=test
GALLERY_LOCAL_TEST_DATABASE=1
DATABASE_NAME=gallery_test_integration
DATABASE_URL=postgresql://gallery_test:local-fixture-only@127.0.0.1:5432/gallery_test_integration
```

The runner verifies the connected target, refuses populated databases, creates
the current schema and a synthetic owner, and passes a private temporary env file
to the suites. It generates an auth secret, strips cloud credentials,
and overrides suite env selectors so `.env.local`/`.env.admin-test` cannot supply
their targets. Each suite retains its original-data preservation checks. The
temporary env file is removed after the child exits, including failure.

The database is not reset or dropped by the runner. CI discards its service;
locally discard only the disposable target you created, with explicit approval.
A rerun needs a new empty database. Schema setup is shared with browser smoke;
this checks the current model, not equivalence of historical SQL migrations.

### Direct feature commands

The individual commands still support their existing isolated test environments.
They verify the actual target before writes and clean their own fixtures.
Do not substitute development, production or a real-user database.

| Command | Environment selection and prerequisites |
| --- | --- |
| `test:projects` | Current-schema isolated Neon test DB; `GALLERY_PROJECT_TEST_ENV_FILE`, default `.env.admin-test`. |
| `test:account` | Current-schema isolated test DB; `GALLERY_ACCOUNT_TEST_ENV_FILE`, default `.env.admin-test`. Real auth/SQL with controlled object storage. |
| `test:admin` | Current-schema isolated test DB with an owner; `GALLERY_ADMIN_TEST_ENV_FILE` and public-profile suite's `GALLERY_PROFILE_TEST_ENV_FILE`, each default `.env.admin-test`. |
| `test:likes` | Current-schema isolated test DB; `GALLERY_LIKES_TEST_ENV_FILE`, default `.env.admin-test`. |
| `test:reads` | Current-schema isolated DB; `GALLERY_IDENTITY_TEST_ENV_FILE` and `GALLERY_READ_TEST_ENV_FILE`, default `.env.admin-test`. CI uses its loopback service. |
| `test:sitemap` | Current-schema isolated DB; `GALLERY_SITEMAP_TEST_ENV_FILE`, default `.env.admin-test`. CI uses its loopback service. |
| `test:auth` | Separately prepared historical demo fixture; `AUTH_TEST_ENV_FILE`, default `.env.auth-test`. Follow [Temporary tests](environments.md#temporary-tests) before preparation. |

These suites have different fixture assumptions; a generic empty DB is not enough
for all of them. Do not glob them together or assume passing browser smoke means
every concurrent transaction test ran. `test:resilience`, `test:images` and
`test:forms` are focused non-cloud checks already included in the unit suite.
Actual provider acceptance and image restore remain separate checks.

## Browser smoke tests

The demo scenarios also exercise local IndexedDB CRUD, image/framing persistence,
reset and storage failures on both widths. They reject real CRUD API calls during
local demo actions, verify authenticated visitors are redirected to their actual
projects, and exercise public navigation with the unchanged browser-based likes.
Demo-project likes stay in IndexedDB; checks cover persistence, rapid clicks,
parallel tabs, failed writes, editing without losing likes, and reset.

The identity-outage browser scenario requires the disposable loopback service.
It temporarily renames only that test database's session table, verifies public
pages remain usable while authenticated private/demo access fails closed, then
restores the table in `finally` and exercises account retry. It never changes
Neon tables, existing environments or application fault-injection settings.

Playwright starts the real built Next.js application on `127.0.0.1:3102`, with
`reuseExistingServer: false`. Setup requires an **empty, disposable** database named
`gallery_test_*`; it creates the current schema using the installed Drizzle API
and inserts synthetic students/admins and a sample project. It never resets a
populated database or copies real accounts. This verifies the current application
schema, not pending production migrations.

Authentication scenarios use the shared smoke fixture's per-test synthetic client
IP, keeping the application's rate limits enabled without sharing one local-client
budget across the suite. Deletion scenarios own their temporary publications and
clean them up in `finally`, preserving records used by other tests.

The small suite covers public navigation/search/final filtering, a like, login
validation and an accessibility check, actual email/password sign-in, a publish
whose server response is deliberately lost followed by a retry, editing/deleting
that publication, and administrator access restrictions. The HTTP/backend and
PostgreSQL are real. Google OAuth, image uploads and external websites are not
exercised; existing controlled storage tests cover image failures. Mobile is
Chromium device emulation, not a Safari/real-device compatibility guarantee.

For local runs, select `.env.smoke` (or `GALLERY_SMOKE_ENV_FILE`) explicitly. Never
reuse `.env.local`, development, production, or a populated Neon test copy. Example
for your own disposable local PostgreSQL instance/container:

```dotenv
GALLERY_DATABASE_ENV=test
GALLERY_LOCAL_TEST_DATABASE=1
DATABASE_NAME=gallery_test_smoke
DATABASE_URL=postgresql://gallery_test:local-fixture-only@127.0.0.1:5432/gallery_test_smoke
```

Local test mode accepts only literal loopback hosts, a test database name and no
URL overrides or Vercel/production context. Before writes/startup it checks the
actual database name and rejects a Neon server behind a local tunnel. Normal
Neon target checks remain unchanged. An empty database on an isolated Neon
`test/*` branch is also supported: omit local mode and supply its actual
`NEON_PROJECT_ID`, `NEON_BRANCH_ID`, `NEON_ENDPOINT_ID` and matching URL/name.

Install Chromium with `npx playwright install chromium` once, then run
`npm run build:smoke` followed by `npm run test:smoke`. If using an existing
compatible Chromium locally, set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` explicitly. The wrapper fixes the local auth
origin, generates a synthetic auth secret and empties cloud credentials, preventing
Next's `.env.local` loading from leaking development integrations into this run.

After a run, discard only the disposable database you explicitly created. A rerun
requires another empty database; setup refuses to wipe the previous one. CI does
this through the service lifecycle. Browser fixtures in `tmp/smoke/`, reports and
traces are ignored by Git. Failure artifacts in GitHub expire after seven days and
contain only synthetic test interactions. Do not run these tests with real users.

Before merging, check the GitHub Actions result for the PR's latest commit;
successful local checks do not establish that the remote CI run passed.
