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
- For open-ended tasks, analyze the problem, discuss options, and agree on
  an approach before implementation. A direct request to implement a specific
  change authorizes that change without further confirmation.

## Design and styles

- Design from the whole to the parts. Start with the overall page composition
  and visual hierarchy, then make individual design decisions in service of that
  whole. Evaluate colors, typography, spacing, proportions, and visual weight
  through their relationships with surrounding elements. A local improvement
  must also work within the larger composition. Keep implementation within the
  agreed scope.
- Maintain visual consistency across the interface.
- When explicitly requested, evolve the design concept, palette,
  typography, layout, and other design decisions.
- Avoid generic template patterns and decorative elements
  without a clear purpose.
- Follow the existing style organization and reuse shared
  variables and components.
- Keep all project styles in `src/app/globals.css`, grouped by component
  with responsive rules nearby. Do not introduce CSS Modules.
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
- Run npm run typecheck and relevant lint checks once after completing
  TypeScript or JavaScript changes; run available tests for affected logic.
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
- Use development for local work and isolated test branches for migration checks
  and write tests. Verify the actual target before database writes.
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
