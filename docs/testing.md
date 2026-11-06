# Regression checks

The goal is quick protection during development, not a full production test platform.

## CI

`.github/workflows/checks.yml` runs on pull requests, pushes to `main`, and manual
requests. It uses Node 22, `npm ci`, lint, TypeScript, the existing non-cloud unit
suites, a Webpack production build, and Chromium smoke tests at desktop/mobile
sizes. A PostgreSQL 18 service container is created for that job and discarded
with the runner. No GitHub secrets, Neon/Vercel access, OAuth or image credentials
are needed. Fork pull requests can run the same checks. The workflow never deploys.

Commands:

```sh
npm run lint
npm run typecheck
npm run test:unit
npm run build:smoke
npm run test:smoke
```

`test:unit` explicitly selects the existing tests that do not write to a cloud
service. Database integration suites (`test:projects`, `test:account`, `test:admin`,
`test:likes`, `test:auth`) retain their separate verified-test-target requirements;
CI does not claim to run all of them. Add new non-cloud tests to the explicit unit
list rather than globbing every test into CI.

## Browser smoke tests

The demo scenarios also exercise local IndexedDB CRUD, image/framing persistence,
reset and storage failures on both widths. They reject real CRUD API calls during
local demo actions, verify authenticated visitors are redirected to their actual
projects, and exercise public navigation with the unchanged browser-based likes.
Demo-project likes stay in IndexedDB; checks cover persistence, rapid clicks,
parallel tabs, failed writes, editing without losing likes, and reset.

Playwright starts the real built Next.js application on `127.0.0.1:3102`, with
`reuseExistingServer: false`. Setup requires an **empty, disposable** database named
`gallery_test_*`; it creates the current schema using the installed Drizzle API
and inserts synthetic students/admins and a sample project. It never resets a
populated database or copies real accounts. This verifies the current application
schema, not pending production migrations.

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

Install Chromium with `npx playwright install chromium` once, then run the last
two commands above. If using an existing compatible Chromium locally, set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` explicitly. The wrapper fixes the local auth
origin, generates a synthetic auth secret and empties cloud credentials, preventing
Next's `.env.local` loading from leaking development integrations into this run.

After a run, discard only the disposable database you explicitly created. A rerun
requires another empty database; setup refuses to wipe the previous one. CI does
this through the service lifecycle. Browser fixtures in `tmp/smoke/`, reports and
traces are ignored by Git. Failure artifacts in GitHub expire after seven days and
contain only synthetic test interactions. Do not run these tests with real users.

CI configuration can be checked locally, but the actual GitHub Actions run remains
unverified until an authorized push makes the workflow available to GitHub.
