# Platform foundation: stage 1

## Scope and application order

Stage 1's model was approved. Stage 2 promotes it to the canonical
`src/db/schema.ts` and replaces the legacy authorization. The configured original
DB remains unchanged: apply both stage 1 and stage 2 SQL migrations only to an
explicitly approved target. The owner's clarification that all existing profiles
are demonstrations removes the need for legacy password/session compatibility.
See [Authentication](../docs/authentication.md) for the current cutover and review
workflow. A historical stage 1 DDL fixture is retained for migration tests.

The isolated copy preserves profiles, publications, credits, likes and membership;
its stage 2 cutover removes obsolete hashes/sessions and makes demos ineligible
for every sign-in method. No actual Google/Vercel deployment check is implied.

## Data model and invariants

- `gallery_users`: the same permanent IDs and public profiles, with `role`
  (`user`/`admin`), `status` (`pending`/`active`/`suspended`), `email_verified`, and
  `updated_at`. New accounts default to pending, unverified non-admin users.
  Stage 1 marks existing rows active without verification or promotion; stage 2
  flags these rows as demos and forbids their sign-in. Existing email strings are preserved; a unique
  normalized index prevents case/whitespace-equivalent duplicate identities.
- `gallery_turmas`: permanent ID, name, optional graduation year, archive date,
  creation date. Names are unique ignoring case/outer whitespace. Archiving is
  organizational: participants retain access, reading, and publishing. It never
  implies suspension, deletion, or removal of membership.
- `gallery_turma_members`: unique turma/user pairs with join dates. Students may
  belong to multiple turmas; graduation retains membership. Group deletion is
  restricted when referenced. There is no cascade from membership to authorship.
- `gallery_projects`: required turma ID independent of its owner's current
  memberships. Preserve publisher ownership, all author links, likes, and `is_final`.
  Adding an author will check membership in the selected turma at application
  level; existing credits survive later membership changes. No automatic repair
  or deletion of historical authorship is performed by the migration.
- Project moderation uses `visibility` (`published`/`hidden`), reason, actor and
  date. Hiding requires a nonempty reason and actor/date; restoration preserves
  those last-decision fields until the next moderation action. This is last-action
  attribution, not a complete audit log. Public reads already filter hidden projects. The admin moderation UI and actor
  authorization belong to stage 3; author edits cannot alter visibility. No permanent moderator deletion or account-deletion feature is added.
- `gallery_invitations`: user, creator, purpose (`activation`/`password_reset`),
  unique SHA-256 token hash, expiry, consumed/revoked dates and creation date.
  Consumed and revoked are mutually exclusive; expired state is derived. Do not
  store raw tokens, activation URLs, or delivery state here. Token consumption
  must be atomic and must check expiry, purpose and account state in stage 2.
  Grant creation and delivery are independent operations: copying a URL now
  and automated sending later use the same activation/recovery logic.

## Better Auth compatibility

The canonical schema includes Better Auth's documented user, account, session and verification
fields. `image` reuses the existing `avatar` column. Explicit adapter mapping
connects `user`, `account`, `session`, `verification` to the target exports. Configure
role/status as server-owned fields (`input: false`); the database schema alone does
not enforce HTTP authorization.

- `gallery_auth_accounts` stores each provider identity separately, with a unique
  `(provider_id, account_id)` pair and the existing user's ID. Google uses the
  stable provider subject. Credential accounts use `provider_id = 'credential'`,
  `account_id = user_id`; a password is not required on the user or Google row.
- `gallery_auth_sessions` and `gallery_auth_verifications` use the core fields
  documented by Better Auth. Stage 2 supplies the handlers, closed activation, durable throttling and session
  revocation; adding tables alone is not an auth system.
- Auth tables start empty. All previous users are confirmed demos, so stage 2
  flags them `is_demo`, removes the legacy password column/session table and does
  not create credential/provider identities for them. New real accounts are
  provisioned separately, with their own passwords or Google bindings.
- Historical `cohort` and `year` remain nullable for later administrator review;
  current queries use membership and project turma instead. They are not a second
  source of truth for new features.
- A first Google login must activate the pre-imported user, not create another
  profile. Match the approved email only from a validated, verified Google identity;
  enforce pending/active/suspended eligibility on the server. Legacy demo accounts are excluded from linking; imported real users must
  satisfy the verified provider identity gate.
  Activation must also invalidate outstanding activation grants. Email/password
  and manually delivered recovery remain functional without Google availability.
- Check actual Google OAuth on a stable public `*.vercel.app` URL during stage 2,
  **before proceeding to stage 3**, once the owner supplies OAuth configuration and
  authorizes that test deployment. SQL account rows are not proof of OAuth working.

## Backfill decisions

Apply after the earlier project migrations, once the application cutover is ready.
The SQL is one atomic transaction and is deliberately applied once: a second
application fails and rolls back instead of recreating removed memberships or
overwriting administrator decisions.

Each distinct legacy cohort label becomes one stable turma ID; existing users
gain memberships and projects use their publisher's legacy turma. Empty groups
from the existing Turma 21–25 selector are also retained. A shared project is not
duplicated. The migration does not add missing coauthors or infer new memberships
from authorship.

If a label has conflicting student graduation years, keep one turma, leave its
year unset, and retain the original years on users for later administrator review.
Do not split a shared group by student-entered years. Missing/blank cohorts,
ambiguous normalized emails, or ambiguous normalized cohort names abort rather
than silently merge or guess. Stage 1 preserves every original value. The approved stage 2 cutover deliberately
discards obsolete demo hashes/sessions; all gallery content and credits survive.

## Verification

Run from the repository root:

```sh
node scripts/check-platform-migration.cjs
```

Requires the existing dependencies and `DATABASE_URL` (loaded from `.env.local`
if not already set), with permission to create a temporary database on that
PostgreSQL server. There is no endpoint that grants database-creation privileges.

This script checks the historical stage 1 migration against its frozen DDL
fixture. Stage 2 additionally checks the final schema in `npm run test:auth`.
The script reads source rows in a read-only consistent transaction, copies them
only into its uniquely named `gallery_platform_test_*` database, and adds fixtures
there. It compares every original column and checks backfill, failed-migration
rollback, schema/model parity, multiple memberships, archived-turma publishing,
preserved credits, identity uniqueness, defaults, and moderation/invitation
constraints. It does not run OAuth, send email, or claim to verify future UI/API
authorization. It removes only its exact temporary database, with `FORCE` to close
remaining connections to that database, and compares the source rows again.
The ignored `tmp/platform-foundation-review/report.json` contains counts/results,
never row copies, emails, password hashes, session tokens or connection strings.

## React / Hono / D1 portability

Keep these permanent string IDs, relationships and business rules across stacks.
Role/status checks use text rather than PostgreSQL enum types. Adapter-specific
timestamps, JSON storage, SQL checks/indexes and data migrations still need a D1
implementation. Do not copy this PostgreSQL SQL into SQLite unchanged. Atomic
invitation consumption and related writes must account for D1's batch semantics
rather than assuming interactive PostgreSQL transactions. Stage 2 uses Better
Auth's runtime-compatible password implementation without legacy credentials.

References:
- [Better Auth core schema and custom fields](https://better-auth.com/docs/concepts/database)
- [Provider accounts and linking](https://better-auth.com/docs/concepts/users-accounts)
- [Hono integration](https://better-auth.com/docs/integrations/hono)
- [D1 support and batching](https://better-auth.com/blog/1-5)
