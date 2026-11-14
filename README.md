# Toti Gallery

A gallery for the Toti community to share learning projects, discover classmates'
work, and credit everyone who contributed. An independent student initiative.

[Explore the gallery](https://toti-gallery.vercel.app/) ·
[Try the demo](https://toti-gallery.vercel.app/demo) ·
[Project presentation](https://toti-gallery.vercel.app/apresentacao)

- **Discover projects:** search and filter by course group, technology or final projects, and explore community profiles.
- **Share work:** publish individual or group projects with descriptions, covers and coauthor credits.
- **Manage the community:** organize course groups and students, import lists, manage access links and moderate projects.

## Try the demo

Create, edit and delete example projects without registering. The demo uses a
fictional student profile; your changes and uploaded images stay only in your
browser and do not appear in the public gallery.

Publishing to the shared gallery requires an account provisioned by the
administration. Google and email/password sign-in use the same profile.

## Stack

Next.js, React, TypeScript, Tailwind CSS, PostgreSQL, Drizzle ORM, and Better Auth.

## Local development

Use Node.js 22 and npm, matching CI.

```sh
npm ci
cp .env.example .env.local
```

Configure `.env.local` with a dedicated development database and a local auth
secret, following the [environment setup](docs/environments.md#local-development).
Keep credentials out of Git. Then run `npm run dev` and open
[localhost:3000](http://localhost:3000).

For initial access in your own installation, see
[first administrator setup](docs/authentication.md#first-administrator).

## Checks

```sh
npm run typecheck
npm run lint
npm run test:unit
```

These checks do not require a database connection. GitHub Actions also runs
database integration and browser smoke suites against disposable PostgreSQL.
For individual suites and their isolated targets, see [Testing](docs/testing.md).

See the [documentation index](docs/README.md) for data contracts and operating guides.
