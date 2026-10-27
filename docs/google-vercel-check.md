# Real Google Sign-In check on Vercel

The owner has verified real Google sign-in at https://toti-gallery.vercel.app for
the existing administrator and imported student, including repeat login and the
student's optional password. The setup checklist below is retained for future
environments; use [Environments](environments.md) for the current database layout.
The agent must not report this gate passed
from localhost, mock provider callbacks or fabricated credentials. Do not begin
stage 3 before the owner approves the stage 2 result, including this check.

## 1. Create the Vercel project

Use the actual intended stable project domain, not a changing preview URL.
From the repository, the owner can sign in and link/create a project:

```sh
npx vercel login
npx vercel link
```

Confirm the resulting project's stable address in Settings → Domains, for example
`https://YOUR-PROJECT.vercel.app`. This does not require ownership of `vercel.app`.
If the CLI asks to create the project, choose this directory, framework Next.js,
and the existing default build settings. A Git commit is not required for a CLI
source deployment. The agent still needs explicit permission to perform a deployment.

## 2. Set server environment variables

In the Vercel project's Settings → Environment Variables, set these for Production:

| Name                   | Value                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `DATABASE_URL`         | Production branch / `toti_gallery`; never a local development or temporary test URL |
| `BETTER_AUTH_SECRET`   | The existing production auth secret; do not rotate for a database rename |
| `BETTER_AUTH_URL`      | `https://YOUR-PROJECT.vercel.app`, without a path                                       |
| `GOOGLE_CLIENT_ID`     | The web client ID from the next section                                                 |
| `GOOGLE_CLIENT_SECRET` | The web client secret from the next section                                             |

Do not paste any secret into chat. `.vercelignore` excludes local environment
files, notes and artifacts from source uploads. Do not enable auth on arbitrary
preview domains or add a trusted `*.vercel.app` wildcard. Changes to Vercel env
variables require a new deployment. Email/password needs no Google variables.

## 3. Create the Google OAuth web client

In [Google Cloud Console](https://console.cloud.google.com/), create a project for
this independent prototype. Open Google Auth Platform:

1. **Branding:** enter the prototype name, support email and developer contact.
   Do not claim this is already an official Toti application.
2. **Audience:** choose External. Testing is suitable for this limited check;
   add the intended test Google accounts if the console offers Test users.
3. **Data Access:** request only basic identity (`openid`, email and profile).
   No Gmail, Drive or Calendar access is needed.
4. **Clients → Create client → Web application.**
5. **Authorized JavaScript origins:** `https://YOUR-PROJECT.vercel.app`.
6. **Authorized redirect URIs:**
   `https://YOUR-PROJECT.vercel.app/api/auth/callback/google`.
7. Optional local check: also add origin `http://localhost:3101` and redirect
   `http://localhost:3101/api/auth/callback/google`.
8. Copy the client ID and secret into Vercel's server environment variables.

Google distinguishes basic Sign-In/testing from public brand verification and
sensitive-scope access. A full production branding review may add requirements;
do not attempt to verify ownership of the entire `vercel.app` domain. If the
console blocks this specific shared-domain configuration, record the exact error
and review it before promising the gate is passed or buying a domain.

References: [Google audience/testing rules](https://support.google.com/cloud/answer/15549945),
[Google brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification),
[Better Auth Google setup](https://better-auth.com/docs/authentication/google).

## 4. Deploy and provision the intended account

After local checks and environment setup, the owner can deploy the current local
source with `npx vercel --prod`, or explicitly ask the agent to perform that action.
This uses the explicitly configured production branch/database; it does not
automatically migrate or replace any database.

Provision the real test Gmail as the first administrator **before Google login**:

```sh
npm run account:admin -- bootstrap --production --env-file=.env.operations \
  --database=toti_gallery --origin=https://YOUR-PROJECT.vercel.app \
  --name="Your name" --email="your-real-email@gmail.com"
```

Do not open its password-activation link yet if testing Google-first activation.
The record must remain pending, with no credential. If a real administrator was
already activated locally, use that account to provision a different consenting
tester's Google email via `add-student` instead. Never reset real test accounts
just to repeat a test.

## 5. Check and record the result

1. Open the **public** `/entrar`, choose Continuar com Google and select the exact
   imported email. Google redirects through the exact registered callback URL.
2. Confirm successful sign-in and that Meu perfil uses the imported user ID.
   No second profile and no mandatory password are created.
3. Sign out and sign in again through Google: same profile and projects.
4. Issue a `reset-link` for that account using the active administrator as actor
   and `--origin=https://YOUR-PROJECT.vercel.app`. Privately open the full URL,
   set a password and verify email/password sign-in. Google still uses the same ID.
5. With a different, unapproved Google account (if available), verify access is
   denied and no new profile appears. Check a suspended account only using a
   deliberately provisioned test fixture, not a real person's access.
6. Separately verify email/password with Google unconfigured on the local test
   server. Do not remove working production settings merely to simulate an outage.

Record the stable URL, date, successful existing-ID activation and alternative
login result in local technical notes, without tokens, OAuth codes or secrets.
`redirect_uri_mismatch` usually means one of base URL, actual domain, client ID or
registered callback differs; compare all four exactly. Never fix it with a wildcard.

If these external steps cannot yet be performed, stage 2 is locally implemented
but remains awaiting its public OAuth verification; it is not complete acceptance.
