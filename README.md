# Toti Gallery

An independent student initiative for sharing learning projects within the
Toti community, discovering ideas, and learning from other people's work.

Students can publish individual and group projects, credit coauthors, explore
the gallery through search and filters, and discover community profiles.
Administrators manage course groups, participants, access, and project moderation.
Sign-in supports Google and email/password.

The interface is in Brazilian Portuguese (pt-BR).

## Stack

Next.js, React, TypeScript, Tailwind CSS, PostgreSQL, Drizzle ORM, and Better Auth.

## Local development

Requires Node.js 20.9+ and npm.

```sh
npm ci
cp .env.example .env.local
```

Configure `.env.local` with a dedicated development database and a local auth
secret, following the [environment setup](docs/environments.md#local-development).
Keep credentials out of Git. Then run `npm run dev` and open
[localhost:3000](http://localhost:3000).

Public sign-up is disabled. See [first administrator setup](docs/authentication.md#first-administrator)
for initial access.

## Checks

```sh
npm run typecheck
npm run lint
npm run test:database-target
```

These checks do not require a database connection. Authentication and admin
tests write fixtures and require an isolated `test/*` database. Follow the
[auth test setup](docs/authentication.md#development-and-isolated-tests) before
`npm run test:auth`, and the [admin test setup](docs/administration.md#checks)
before `npm run test:admin`.
