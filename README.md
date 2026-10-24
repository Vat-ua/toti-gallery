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

Use a separate PostgreSQL test database: the application currently adds sample
data automatically.

```sh
npm ci
cp .env.example .env.local
```

Create an empty test database and set `DATABASE_URL` in `.env.local` to its
connection string. Then create the tables using the current schema:

```sh
npx drizzle-kit push --config=drizzle.config.ts
```

Review the proposed schema changes before applying them to the test database.
Start the development server:

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
