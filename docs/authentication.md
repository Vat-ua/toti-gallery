# Authentication and closed activation

Better Auth handles Google identities, email/password and sessions. Accounts
are provisioned by the administration; there is no public sign-up. One permanent
user ID owns the profile, publications and credits regardless of sign-in method.
Google is optional at runtime: email/password and manually delivered recovery
links work without OAuth configuration or availability.

## Accounts and eligibility

Accounts are pending until activation, active afterward, or suspended to block
access while retaining their data. Application access also requires a verified
email and a non-demo profile. The public profile displays the selected primary
turma, or the highest-numbered membership when no preference is set; project
turma is stored independently.
New publications default to the highest-numbered membership and allow choosing
another of the author's turmas, including archived ones. Published projects keep
their saved turma. Only active, verified, non-demo members are offered as new
coauthors; existing credits survive membership changes.

Database profiles marked `is_demo` are display content, not sign-in identities.
They cannot activate, link Google or receive password grants. They are distinct
from the browser-only [demonstration workspace](user-stories.md#demonstration-mode).
The application does not seed sample data during requests. The historical demo-only
auth cutover must never be replayed on current accounts; see
[Migrations](../migrations/README.md).

## Development and isolated tests

Use `development / toti_gallery` via `.env.local` and `npm run dev` for normal
development. Production maintenance uses `.env.operations` with `--production`.
See [Environments](environments.md) for exact resource guards and configuration.

For suite selection and coverage, see [Testing](testing.md#database-integration-suites).
`test:integration` includes current auth workflows on disposable local PostgreSQL,
with mocked Google responses; `test:auth` selects those workflows directly.
Historical cutover verification is separate as `test:auth:migration`; follow
[Temporary tests](environments.md#temporary-tests) for its prepared Neon fixture.
Never point tests at development, production or real staff accounts. The optional
historical auth-test server uses port 3101; normal development uses port 3000.

## First administrator

Only an installation without staff accounts needs bootstrap. For the intended
development target, run the trusted command with your own values:

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

## Provisioning and manual delivery

Use Administração → Turmas/Estudantes for student registration and access links;
the owner manages staff in Administradores. See [Administration](administration.md)
for these workflows. The trusted CLI remains available for explicit maintenance:

```sh
npm run account:admin -- add-student --env-file=.env.local \
  --database=toti_gallery --actor="ADMIN_EMAIL" \
  --name="Student name" --email="STUDENT_EMAIL" --turma="EXISTING_TURMA_NAME"

npm run account:admin -- activation-link --env-file=.env.local \
  --database=toti_gallery --actor="ADMIN_EMAIL" --email="STUDENT_EMAIL"

npm run account:admin -- reset-link --env-file=.env.local \
  --database=toti_gallery --actor="ADMIN_EMAIL" --email="STUDENT_EMAIL"
```

The actor must be an active, non-demo administrator. Repeated provisioning reuses
the same email identity/membership; it never resets a password, promotes a role,
reactivates a suspended user or converts a demo. Archived turmas remain usable.
The first administrator may have no turma; associate an account through provisioning
when it should also publish projects. An account without a turma can sign in/edit
its profile but cannot publish until an administrator assigns one.

`createAccessLink` returns `{ id, url, expiresAt }`. It does not send mail or depend
on a delivery provider. The CLI currently prints that result for private manual
delivery to the intended email. Administrative operations share the grant
primitives in `access-links.ts`; a future email provider can consume their results
without changing activation. Sending failures
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

## Google deployment setup and acceptance

Use the existing linked Vercel project and the approved
[Git release workflow](environments.md#development-workflow). For a new origin,
configure a Google OAuth **Web application** client with basic identity scopes
(`openid`, email and profile):

- Authorized JavaScript origin: the exact `https://YOUR-PROJECT.vercel.app` origin.
- Authorized redirect URI: that origin plus `/api/auth/callback/google`.
- For local OAuth, register the exact local `BETTER_AUTH_URL` and callback too.
- If the Google app uses Testing audience restrictions, add intended testers.

Set the web client ID/secret and exact `BETTER_AUTH_URL` in the matching Vercel
environment. Retain the existing auth secret for an existing auth database.
Deployment-variable changes require an approved deployment. Do not trust arbitrary
Preview domains, add a `*.vercel.app` wildcard, or copy production credentials to
Preview. Consult [Better Auth Google setup](https://better-auth.com/docs/authentication/google)
and [Google brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)
for current provider requirements.

For an approved deployment/callback change, use deliberately provisioned fixtures:

1. Record a student's pending ID with no credential. Sign in through its matching
   Google account; verify activation keeps that ID and creates no duplicate profile.
2. Sign out and repeat Google sign-in. Issue a password grant privately, set a
   password, and verify sign-out/sign-in with both methods and one profile.
3. Where available, check an unapproved Google identity is denied without creating
   a user. Test suspension only with an intended fixture, not real users' access.
4. Separately test email/password without Google in isolation; do not remove
   working production settings to simulate an outage.

Record date, URL, deployed commit and outcomes privately without OAuth codes or
tokens. Local/mocked callbacks do not establish public OAuth success.
`redirect_uri_mismatch` requires comparing the actual origin, base URL, client ID
and registered callback exactly, not relaxing origin validation.

## Portability and later domain transfer

A future React/Hono/D1 version would need to preserve user IDs, provider bindings,
password compatibility, memberships and credits. PostgreSQL queries, locks and
transactions require an explicit equivalent implementation; current operations
also depend on Next's request APIs where relevant. This is not a copy-only SQL
migration or a required change to the current application.

Keep the auth secret stable across deployments sharing an auth database: it also
protects cookies/OAuth material. Use the library's supported rotation process when
needed. A later official domain changes base URL, trusted origin, callback settings
and DNS; users sign in again because cookies do not transfer between these domains.
