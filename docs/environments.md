# Database environments

The `toti-gallery-us` Neon project in AWS US East (N. Virginia),
`aws-us-east-1`, uses a persistent `production` branch, a separate persistent
`development` branch, and temporary `test/*` branches. A Neon branch contains
PostgreSQL databases; these are different resources. Both persistent branches
contain `toti_gallery` (current application) and `toti_gallery_legacy` (retained
historical data). The standard `postgres` database is for maintenance only.
The original empty `neondb` remains unused; the application connects to
`toti_gallery`.

## Local development

Use `.env.local` with the **development** endpoint, its separate database password,
and the metadata shown in `.env.example`. Use a separate Better Auth secret and
`BETTER_AUTH_URL=http://localhost:3000`, then run `npm run dev`.

The cloned database retains profiles/projects/IDs. It is independent of online
writes. Copied session cookies are not reusable under the local secret. Google
is optional locally; without a deliberately configured local OAuth callback and
both Google variables, use email/password. Do not change production auth settings
to configure development.

The runtime rejects the production endpoint outside Vercel Production or an
explicit maintenance command. Database identities are verified before CLI/test
writes. Resource IDs are not passwords: the actual connection must match them.
Keep all private environments ignored and never upload them to Vercel.

## Production

Vercel Production uses `production / toti_gallery`. Changing DATABASE_URL requires
a new deployment. Renaming the database preserves identities, credentials,
sessions, project authorship and data; it does not require a new auth secret.

For trusted manual provisioning/recovery, use an ignored `.env.operations` file
with the production URL, original auth secret, public origin, and:

```dotenv
GALLERY_DATABASE_ENV=operations
DATABASE_NAME=toti_gallery
NEON_PROJECT_ID=solitary-voice-43626583
NEON_BRANCH_ID=br-empty-resonance-b805h6hx
NEON_ENDPOINT_ID=ep-wandering-wind-b8wg9taw
```

Select it explicitly and pass `--production`, for example:

```sh
npm run account:admin -- reset-link --production --env-file=.env.operations \
  --database=toti_gallery --actor="ADMIN_EMAIL" --email="STUDENT_EMAIL"
```

Without those explicit options, the account CLI defaults to development. An env
file alone does not authorize production. Do not use `.env.production.local` for
maintenance credentials: Next loads that file automatically for local builds.

## Temporary tests

Never point `.env.auth-test` at production or the development database. The auth
suite creates fixtures and cleans its test data, including rate-limit records.

1. Explicitly create a temporary `test/auth-*` Neon branch from development.
   Assign an expiration when creating the branch. It contains a separate copy
   of both databases and cannot change its parent.
2. Configure ignored `.env.test-source` with that branch's endpoint/credentials,
   `DATABASE_NAME=toti_gallery_legacy`, its NEON_PROJECT_ID/BRANCH_ID/ENDPOINT_ID,
   and `GALLERY_DATABASE_ENV=test`. Never supply production identifiers.
3. Run `node scripts/prepare-auth-test.cjs`. It verifies the real branch, copies
   the historical demo rows into a fresh `gallery_auth_test_*` PostgreSQL DB on
   the **test branch**, applies the reviewed auth, owner and turma-details migrations there, and writes
   `.env.auth-test`. It never replays the demo cutover on current real accounts.
4. Run `npm run test:auth`. Optional `dev:auth-test`, `build:auth-test` and
   `start:auth-test` serve only that explicitly prepared test target on port 3101;
   normal development uses `npm run dev` on port 3000.

After a test branch expires, select a new temporary branch and archive/reset only
its local test config before preparation. Never reset production to repeat tests.
For new migration verification, use a temporary copy of the current production
database. Apply accepted SQL migrations separately to production; do not merge
test/development rows into online data.

The historical `check-platform-migration.cjs` verifier requires a test branch and
legacy-schema source. Load `.env.test-source` explicitly when using it; a fresh
shell running it against `.env.local` is rejected. Its temporary SQL database is
created and removed only inside that selected test branch.

## Retained São Paulo project

The previous Neon project in `aws-sa-east-1` is retained unchanged as a migration
fallback. Normal development, tests and Vercel use `toti-gallery-us`. Do not point
new write tests at the retained project or resume writes there during normal use.

Production and development were migrated separately, preserving their different
schemas and records. Restoring a previous Vercel deployment also restores its old
database environment; the matching Production environment variable must be
restored before any subsequent rebuild. Once new writes exist in the US database,
returning to São Paulo requires reconciling those writes first. Old connections,
source snapshots and restoration evidence are kept in ignored local migration
notes; they must never be committed.
