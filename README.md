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

Requirements: Node.js 20.9 or later, npm, and a PostgreSQL development database.

```sh
npm ci
cp .env.example .env.local
```

Set `DATABASE_URL` in `.env.local` to your development connection string.
For a fresh, disposable development database, create the tables from the current
schema using the environment-based TypeScript configuration:

```sh
npx drizzle-kit push --config=drizzle.config.ts
```

Review the proposed schema changes before applying them. Existing or shared
databases need reviewed migrations; this repository does not yet contain a
versioned migration history. The application seeds sample people and projects on
first gallery access when the demo user is absent, so use a development database.

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

Playwright and axe are installed, but there is currently no committed automated
test suite or `test` script. Match checks to the change; UI changes need mobile
and desktop review, while minor CSS changes do not require a full build.

If Turbopack cannot process CSS because the environment blocks its local port
binding, `npm run build -- --webpack` is an available build alternative. It passed
during the initial typography review.

## Project structure

```text
src/app/         Pages, route handlers, and global styles
src/components/  Shared interface components
src/db/          Database connection and schema
src/lib/         Authentication, queries, validation, and sample data
public/          Static assets
```

The source references local fonts in `public/fonts/` and images in `public/images/`.
Those assets are currently absent from this checkout; fonts fall back to system
fonts and some images are unavailable. Restore the original assets for a complete
visual review.

## Working agreements

See [AGENTS.md](AGENTS.md) for contribution and agent instructions.
Keep credentials in local environment files and use `.env.example` for placeholders.
The root `tmp/` directory is reserved for personal ideas and drafts and is ignored
by Git. Local screenshots and review reports in `artifacts/` are also ignored.
