# Database environments

One Neon project uses a persistent `production` branch, a separate persistent
`development` branch, and temporary `test/*` branches. A Neon branch contains
PostgreSQL databases; these are different resources. Both persistent branches
contain `toti_gallery` (current application) and `toti_gallery_legacy` (retained
historical data). The standard `postgres` database is for maintenance only.

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
NEON_PROJECT_ID=morning-bread-11732042
NEON_BRANCH_ID=br-hidden-surf-b61a7h3q
NEON_ENDPOINT_ID=ep-fragrant-mode-b67j07hn
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
