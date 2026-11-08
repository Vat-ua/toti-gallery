# Toti Gallery

## Project

- A gallery of learning projects from the Toti community.
- Stack: Next.js App Router, React, TypeScript, Tailwind CSS,
  PostgreSQL, and Drizzle ORM.
- Use npm and maintain package-lock.json.
- Keep interface copy in Brazilian Portuguese (pt-BR).
- Maintain project documentation in English.

## Scope

- Keep changes focused on the requested outcome, including necessary changes
  to shared contracts and affected consumers. Report unrelated issues separately.
- Preserve existing user changes; avoid unrelated refactoring and dependencies.
- For analysis or design requests, present findings and trade-offs before coding.
  For implementation requests, make routine engineering decisions autonomously.
  Explain and seek approval before substantially expanding the requested scope,
  changing established architectural decisions, or affecting protected resources,
  unless the action is already explicitly authorized.

## Architecture and data contracts

- For non-trivial changes, trace the affected data flow and its consumers before
  implementing. Design for growth beyond the current demo dataset.
- For complex or reused workflows, separate business operations from UI
  and HTTP handling. Avoid layers that only forward calls.
- Enforce validation and authorization on the server. Preserve transaction
  boundaries and handle retries, concurrency, and partial failures where relevant.
- Review the critical rendering path. Run independent reads concurrently;
  do not block page content on unrelated data.
- Bound queries and responses for growing collections. Filter, sort, paginate,
  and aggregate in the database when appropriate; do not fetch entire collections
  merely to render a subset or compute summaries.
- Fetch only fields and related records needed by the consumer; avoid redundant
  queries and per-item query fan-out.
- Keep input normalization, authorization, visibility rules, and response/error
  semantics consistent across entry points for the same operation. Update
  affected consumers when a contract changes.
- Keep pagination and client/server state reconciliation correct as data changes.
- Do not put private or personalized responses in shared cross-user caches.
  Request-scoped deduplication is allowed; authorization checks must remain current.
- Use `docs/data-loading.md` for collection queries, pagination, filtering,
  API contracts, caching, and client data synchronization. Keep it aligned with
  significant architectural changes; do not duplicate code-level types there.

## Design and styles

- Design from the overall page composition and visual hierarchy to details;
  evaluate local changes in context and preserve consistency across the UI.
- When requested, evolve the design concept rather than limiting changes to
  cosmetic adjustments. Avoid generic templates and purposeless decoration.
- Reuse existing shared variables and components.
- Keep custom CSS in `src/app/globals.css`, grouped by component with responsive
  rules nearby. Do not introduce CSS Modules. Preserve the existing Tailwind
  usage without mixing styling approaches unnecessarily.
- Define font families and recurring typography and spacing values as shared
  CSS variables. Use rem for UI font sizes, unitless multipliers for line-height,
  and clamp() where fluid text sizes are useful.
- Use a consistent spacing scale. Update existing component rules and remove
  obsolete styles rather than accumulating overrides.
- Agree on changes to the styling approach before introducing them.
- Use 16–18 px for primary body text and 14–16 px for secondary text,
  with smaller sizes only when clearly justified.
- Maintain readable typography, semantic markup, keyboard access,
  visible focus states, and labeled form controls.

## Validation

- Match validation to scope and risk; batch related edits before checking.
- Run `npm run typecheck` and relevant lint checks once after completing
  TypeScript or JavaScript changes; run available tests for affected logic.
- For data-flow or contract changes, verify relevant boundaries and regressions
  (including changed datasets, stale results, and permissions when applicable).
- Tests must own mutable fixtures and remain independent of execution order.
- For small UI changes, inspect the page at one desktop and one mobile width,
  including affected interactions. Broaden coverage when the change warrants it.
- Repeat only checks affected by subsequent edits, failures, or unresolved issues.
- A full build is not required for minor CSS-only changes.
  Run it when changes affect build behavior, routing, dependencies,
  configuration, or server/client boundaries.
- Report what was checked and any verification limits.

## Data and Git

- Follow [docs/environments.md](docs/environments.md) for Neon, migrations,
  and Vercel operations.
- Use the development database environment for local work and isolated Neon
  database branches for migration checks and tests that modify cloud data.
  Local/CI tests may use disposable PostgreSQL databases per `docs/testing.md`.
  Verify the actual target before database writes.
- Obtain explicit approval for production changes. Before production migrations,
  prepare a recovery path and verify data preservation on an isolated copy.
- Never commit secrets or local environment files.
- Accompany database schema changes with appropriate migrations.
- Use test data when validating write operations.
- Do not delete or reset database data without explicit approval.
- Review the diff and staged files before committing.
- Do not create commits, push, or deploy without explicit instruction.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
