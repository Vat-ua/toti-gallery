# Database environments

The `toti-gallery-us` Neon project in AWS US East (N. Virginia),
`aws-us-east-1`, uses a persistent `production` branch, a separate persistent
`development` branch, and temporary `test/*` branches. A Neon branch contains
PostgreSQL databases; these are different resources. Both persistent branches
contain `toti_gallery` (current application) and `toti_gallery_legacy` (retained
historical data). The standard `postgres` database is for maintenance only.
The original empty `neondb` remains unused; the application connects to
`toti_gallery`.

## Development workflow

1. Start each task from the latest `main` in a separate Git branch, such as
   `feat/password-recovery` or `fix/project-editor`.
2. Develop locally with the Neon `development` database. Use isolated `test/*`
   database branches for migration checks and tests that modify fixtures.
3. Run checks appropriate to the change and let the project maintainer review it in
   the browser. Commit and push the task branch only when explicitly requested;
   pushing it does not deploy Production while Preview is disabled.
4. Before release, review all pending migrations against the actual Production
   columns, constraints and indexes. Test required migrations on an isolated
   Production copy, verify data preservation and prepare a recovery path. Apply
   approved migrations before publishing code that depends on them.
5. After explicit publication approval, merge the reviewed branch into `main`
   and push it to GitHub. Vercel then builds and deploys that commit automatically.
6. Verify the deployed behavior, including affected authenticated pages with the
   appropriate role. A successful build, public-page checks or anonymous redirects
   alone do not verify the administration area. Report any checks that still need
   manual login and review.

Git branches version code; Neon branches isolate database state. Merging code
does not synchronize users, roles or other records between databases. Keep normal
local development connected to Neon `development` when switching Git branches.

## Data ownership and refreshes

Production is the reference for agreed online data, including real accounts,
demonstration profiles, turmas and projects. Development is an independent working
copy for implementation and experiments; its records do not need to match
Production at all times.

- Keep schemas aligned through reviewed migrations. Transfer selected data only
  when explicitly agreed; do not synchronize the databases automatically.
- Make ongoing, agreed content and turma changes in Production. An accepted
  development experiment can be transferred selectively, preserving existing IDs
  and relationships rather than replacing whole tables or databases.
- Refresh development from Production only when needed, after the current task is
  complete and the refresh is explicitly approved. Review or preserve local test
  work first: a refresh can replace those records. Keep development credentials,
  auth origin, secret and storage target separate from Production.
- A selective turma update changes only its approved fields. It does not copy
  users, credentials, roles, memberships, projects, authorship or likes.

## Local development

An additional developer needs an independent target, not shared write access to
the maintainer's development or production database. A dedicated branch can
provide isolation within this project; an independent Neon project also separates
account quotas. External projects require adapting the runtime's explicit project
allowlist before use; arbitrary endpoints are deliberately rejected.
Before sharing a dataset, remove real credentials, OAuth tokens, sessions and
access grants, and use synthetic or approved sanitized profiles. Provision a
local test login. No access to production, Vercel or this project's control plane
is needed. Do not assume an old developer-specific branch is still provisioned.

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

Vercel Production uses `production / toti_gallery`. Changing `DATABASE_URL`
requires a new deployment. A renamed database does not by itself require a new
auth secret; preserve existing account and credential data when switching targets.

The existing Vercel project connects to `Vat-ua/toti-gallery` on GitHub, with
`main` as its Production branch. A push/merge to `main` publishes the committed
code automatically: obtain deployment approval before that push/merge. Use feature
branches for ongoing work. `vercel.json` disables automatic deployments from
other branches. An explicitly approved manual Preview can be created from a
reviewed feature commit after configuring its isolated environment.
The catch-all rule uses `"**": false` because `"*"` does not match branch names
containing `/`. The explicit `"main": true` rule permits Production deployments.
Never copy Production secrets or its database connection into Preview.

### Manual Preview

Use the existing Vercel project and deploy the exact pushed feature commit as a
Preview, never as Production. Keep automatic feature-branch deployments disabled.
Scope Preview variables to that Git branch: the verified Neon development
database and its matching storage credentials, database identity metadata, a
separate generated Better Auth secret, and the exact HTTPS Preview branch origin.
Do not upload local environment files. Email/password uses development accounts;
Google stays disabled unless its separate callback has been explicitly configured.

Preview writes affect development, including its images and likes; they never
synchronize to Production. The existing Vercel deployment protection remains in
place. Verify the deployed commit, target, origin and branch alias before testing,
and confirm the Production deployment ID is unchanged. CI uses its disposable
PostgreSQL service independently of this Preview database.

After review and separate approval, merge into `main` through the normal release
workflow. Preview success does not authorize that merge or a Production deployment.

Database migrations are separate from the build. Verify them on an isolated
production copy, prepare a recovery path, then apply approved migrations before
publishing code that requires them. Assess code/schema rollback compatibility
for the actual release; do not assume every upgrade is additive. Rolling back
an application deployment does not roll
back database or object-storage writes. Migration history is in
[Migrations](../migrations/README.md); inspect the target rather than inferring
its current schema from an earlier release record.

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

CI uses a disposable PostgreSQL service on loopback, with an explicit local-test
guard and an empty `gallery_test_*` database. It has no Neon/Vercel credentials.
See [Regression checks](testing.md). The Neon workflows below remain separate.

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

For the prototype’s current recovery limits and a manual database/image backup
procedure, see [Backup and restore](backup-and-restore.md).
