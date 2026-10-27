# Authentication and closed activation

Better Auth 1.7.13 handles Google identities, email/password and sessions. Accounts
are provisioned by the administration; there is no public sign-up. One permanent
user ID owns the profile, publications and credits regardless of sign-in method.
Google is optional at runtime: email/password and manually delivered recovery
links work without OAuth configuration or availability.

## Current stage and data

Stage 2 implements authentication and server-side provisioning. Stage 3 adds
Turmas administration and group imports; global student management, project
moderation and administrator management follow in separate parts. Until then the
existing UI displays the earliest membership as the primary turma; project turma
is stored independently. Do not deploy the old database with this new runtime.

The owner confirmed that **every existing account, including their test account,
is a demo**. Apply the stage 1 foundation and stage 2 cutover migrations only to the
intended database, after approval. The cutover marks existing profiles `is_demo`,
discards their old password hashes/session table, and gives them no Better Auth
credentials. Demo profiles, projects, author links, covers and likes are retained.
Demo users cannot be activated, linked to Google or given password-reset grants.
The application no longer creates sample data during requests.

For a new empty database, the canonical `src/db/schema.ts` creates the final
schema directly. The legacy group/year columns are retained only for later data
review; current authentication/membership queries do not use them.

## Development and isolated tests

Use `development / toti_gallery` via `.env.local` and `npm run dev` for normal
development. Production maintenance uses `.env.operations` with `--production`.
See [Environments](environments.md) for exact resource guards and configuration.

For authentication regression tests, first select a temporary Neon test branch
and configure `.env.test-source` as documented there, then prepare its fixtures:

```sh
node scripts/prepare-auth-test.cjs
npm run dev:auth-test
```

Preparation reads the source URL from `.env.test-source` and copies its historical
demo data into a new `gallery_auth_test_*` database on the verified test branch. It needs permission
to create databases. It applies the auth foundation/cutover, owner and turma-details
migrations only to that copy, checks content
preservation, and leaves the source and `.env.local` unchanged. Its generated
`.env.auth-test` is ignored and mode 0600. Keep it private. Preparation refuses to
overwrite an already configured target; the test copy is retained until its
temporary branch expires or is explicitly removed.

Open `http://localhost:3101` for test fixtures. Use `build:auth-test` /
`start:auth-test` for that same isolated test environment. The normal development
server remains on port 3000; the public application uses production separately.

## First administrator

Run the trusted local/server command, replacing the placeholders:

```sh
npm run account:admin -- bootstrap --env-file=.env.local \
  --database=toti_gallery \
  --name="Your name" --email="your-real-email@gmail.com"
```

The command verifies the real Neon branch/endpoint and database before writing.
For production bootstrap, explicitly use `.env.operations` and `--production`.
An existing active administrator closes bootstrap; never reset it to repeat a test.

Bootstrap creates one **pending owner** (the first administrator) and outputs a one-time activation
link, not a password. Open the complete link and choose a 15–128 character password,
then sign in. A later bootstrap cannot promote another account or replace an
active administrator. Repeating it with the same pending administrator's email
reissues their activation link. Existing/demo accounts are never promoted.
There is no bootstrap HTTP endpoint and no hardcoded administrator credentials.

## Provisioning and manual delivery before the admin UI

```sh
npm run account:admin -- add-student --env-file=.env.local \
  --database=toti_gallery --actor="admin@gmail.com" \
  --name="Student name" --email="student@gmail.com" --turma="Turma 24"

npm run account:admin -- activation-link --env-file=.env.local \
  --database=toti_gallery --actor="admin@gmail.com" \
  --email="student@gmail.com"

npm run account:admin -- reset-link --env-file=.env.local \
  --database=toti_gallery --actor="admin@gmail.com" \
  --email="student@gmail.com"
```

The actor must be an active, non-demo administrator. Repeated provisioning reuses
the same email identity/membership; it never resets a password, promotes a role,
reactivates a suspended user or converts a demo. Archived turmas remain usable.
The first administrator may have no turma; associate an account through provisioning
when it should also publish projects. An account without a turma can sign in/edit
its profile but cannot publish until an administrator assigns one.

`createAccessLink` returns `{ id, url, expiresAt }`. It does not send mail or depend
on a delivery provider. The CLI currently prints that result for private manual
delivery to the intended email. The Turmas admin UI uses the same service; a
future email provider can use it without changing activation. Sending failures
must not create duplicate users or alter activation.
Do not store bearer URLs in notes, commits, analytics, screenshots or shared logs.

Activation grants last 48 hours; recovery grants last one hour. Reissue revokes
earlier grants of the same purpose. Password changes through a grant consume it
atomically, revoke all other outstanding grants for that user and end all sessions.
Simply opening a link does not consume it. The URL token is in the fragment so it
is not sent in page requests; the form removes it from browser history and sends
it only in the POST body. If the page is refreshed, reopen the original full link.
After success the user signs in explicitly; recovery does not automatically log in.

The activation page validates the grant without consuming it and shows the intended
email. With Google configured, the student can use that Google account or create
a password; without it, password activation remains available. A recovery grant
instead shows a password-definition form, without the Google activation choice.

An active Google-only account may receive a recovery link to add a local password
without an old password. Existing credential users change passwords in Editar
perfil by confirming the old password; other sessions are revoked. During manual
delivery, verify a recovery request through the person's known contact channel.

## Google and account binding

Configure both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, or neither. Absence of
Google settings leaves email/password functional and the sign-in page explains
that Google is not configured. Never put provider secrets in `NEXT_PUBLIC_*`.

Google sign-in requests basic identity scopes only. Better Auth performs the OAuth
code/PKCE/state flow; the admission gate requires a verified email matching an
existing approved, non-demo, non-suspended user. First login activates that exact
row, preserves its ID/name/profile and revokes unused activation grants. It creates
only a provider identity, not a user or a mandatory credential. Local-first users
may also sign in with their matching verified Google account. A different email
for an already-linked Google subject is rejected. Unknown identities never sign up,
even when a client supplies `requestSignUp` or role/status fields.

Google activation started from an invitation is additionally bound to that
invitation's user and live grant. The server validates the token before OAuth,
stores only the validated IDs in Better Auth's trusted `serverContext`, and checks
them again at callback. The raw bearer token is not persisted in OAuth state.
A different Google email cannot activate another invited profile through that
link. Ordinary Google sign-in for approved students remains available independently.

Only a small allowlist of Better Auth HTTP endpoints is exposed. Other library
routes (including public sign-up, arbitrary user/email updates, account deletion,
provider token access and alternate reset paths) are closed. Profile/password
operations use the app's validated routes. Additional fields are server-owned.
Current account state is checked for app access even with an existing session.
Cookies are HttpOnly, same-site and secure on HTTPS. Exact trusted origin comes
from configuration, not Host headers. Login throttling is database-backed, with
an additional account-based limit and limits on grant redemption/password changes.

## Verification

```sh
npm run test:auth
npm run build:auth-test
```

Auth tests require the fresh isolated copy, refuse a pre-existing real administrator,
and remove only their own fixture accounts. They check bootstrap, signup/demo denial,
expiry/reissue/replay, concurrent redemption, recovery/session revocation, identity
binding, blocked users, origin checks and durable rate limits. Google callback tests
replace Google's token endpoint inside the test process; they **do not verify an
actual Google login, Google Cloud setup or public Vercel deployment**.

The owner has verified real Google and email/password sign-in for the administrator
and student on the public site, including after the production database switch.
See [Google on Vercel](google-vercel-check.md) for the retained acceptance checklist.
Local tests alone do not establish that public OAuth works. Further stage 3 parts
and production rollout require the owner's explicit approval.

## Portability and later domain transfer

Keep user IDs, provider subject bindings, memberships and author links when moving
to React + Hono + D1. Better Auth's default password implementation supports its
target runtimes; there is no legacy Node-only password format to carry forward.
The server services have no Next imports; only the session/UI layer is Next-specific.
PostgreSQL Drizzle queries, bootstrap locks and transactions still need an explicit
D1 implementation with equivalent atomicity. This is not a promise of copying SQL.

Keep the auth secret stable across deployments sharing an auth database: it also
protects cookies/OAuth material. Use the library's supported rotation process when
needed. A later official domain changes base URL, trusted origin, callback settings
and DNS; users sign in again because cookies do not transfer between these domains.
