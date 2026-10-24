# Toti Gallery

## Project

- A gallery of learning projects from the Toti community.
- Stack: Next.js App Router, React, TypeScript, Tailwind CSS,
  PostgreSQL, and Drizzle ORM.
- Use npm and maintain package-lock.json.
- Keep interface copy in Brazilian Portuguese (pt-BR).
- Maintain project documentation in English.

## Scope

- Keep changes focused on the requested task.
- Preserve existing user changes.
- Avoid unrelated refactoring and dependency changes.

## Design and styles

- Maintain visual consistency across the interface.
- When explicitly requested, evolve the design concept, palette,
  typography, layout, and other design decisions.
- Avoid generic template patterns and decorative elements
  without a clear purpose.
- Follow the existing style organization and reuse shared
  variables and components.
- Agree on changes to the styling approach before introducing them.
- Use 16–18 px for primary body text and 14–16 px for secondary text,
  with smaller sizes only when clearly justified.
- Maintain readable typography, semantic markup, keyboard access,
  visible focus states, and labeled form controls.

## Validation

- Match validation to the scope and risk of the change.
- Run npm run typecheck for TypeScript or JavaScript changes.
- Run relevant lint checks and available tests for the affected code.
- For UI changes, check mobile and desktop layouts, text wrapping,
  overflow, and affected interactions.
- A full build is not required for minor CSS-only changes.
  Run it when changes affect build behavior, routing, dependencies,
  configuration, or server/client boundaries.
- Report what was checked and any verification limits.

## Data and Git

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
