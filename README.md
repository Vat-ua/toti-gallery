# Toti Gallery

A gallery of learning projects from the Toti community, with project discovery,
community profiles, likes, and project publishing and editing.
The interface is in Brazilian Portuguese (pt-BR).

## Stack

- Next.js App Router, React, and TypeScript
- Tailwind CSS and shared custom CSS in `src/app/globals.css`
- PostgreSQL with Drizzle ORM
- npm with a committed `package-lock.json`

## Local setup

Requirements: Node.js 20.9 or later, npm, and PostgreSQL.

Use the dedicated Neon `development` branch. Sample data is not created
automatically, and public registration is disabled.

```sh
npm ci
cp .env.example .env.local
```

Set `DATABASE_URL` to `development / toti_gallery`, fill in its Neon resource IDs,
and generate a separate `BETTER_AUTH_SECRET`. Use `http://localhost:3000` for
`BETTER_AUTH_URL`. The development copy already contains the current schema;
do not rerun historical cutover migrations. See [Environments](docs/environments.md)
for connection guards and temporary test setup. Start the development server:

```sh
npm run dev
```

Open the Local URL printed by Next.js, normally `http://localhost:3000`.
`GET /api/health` checks database connectivity.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run typecheck` | Check TypeScript without emitting files |
| `npm run lint` | Run ESLint |
| `npm run build` | Create a production build |
| `npm start` | Serve a completed production build |
| `npm run test:database-target` | Check environment guards without a database |
| `npm run test:auth` | Check authentication on an explicitly prepared temporary test branch |

## Project structure

```text
src/app/         Pages, route handlers, and global styles
src/components/  Shared interface components
src/db/          Database connection and schema
src/lib/         Authentication, queries, validation, and utilities
public/          Static assets
```

## Development guidelines

See [AGENTS.md](AGENTS.md) for contribution and agent instructions.
Keep credentials in `.env.local`, which is ignored by Git. Use `.env.example` to
document required variables with placeholder values, and never commit secrets.

## Accounts

Better Auth supports administrator-provisioned email/password and optional Google
Sign-In on the same profile. Activation and recovery use single-use links delivered
manually; no email service is required. Existing demonstration profiles cannot sign in.

See [Authentication](docs/authentication.md) for the first-administrator command,
isolated review environment, account provisioning and migrations. See
[Google on Vercel](docs/google-vercel-check.md) for the public OAuth check.
