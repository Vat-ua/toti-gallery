# Database migrations

For a new, empty database, follow the root README and create the current schema
with Drizzle. No request-triggered sample seed or demo login is installed.

For an existing database, apply pending `.sql` files in filename order using a
PostgreSQL client or SQL editor connected to the intended database. They are not
applied automatically when the application starts. Schema synchronization alone
does not replace the authorship data backfill.

**Auth cutover:** `toti_gallery` already has both auth migrations. The historical
`toti_gallery_legacy` database is retained; do not apply current migrations to it
without approval. A migration from the historical schema requires both
`20261026_stage1_platform_foundation.sql` and `20261026_stage2_auth_cutover.sql`,
applied in that order with the new code and writes paused. Do not run the new code
against the old schema or schema-push over existing data. Isolated review uses a
temporary test branch; see [Environments](../docs/environments.md).

`20261026_add_project_authors.sql` adds authorship links and backfills existing
owners without changing project records. Deleting a project removes its links
and likes; deleting a coauthor removes only that person's links. An account that
owns publications cannot be deleted until an explicit ownership-transfer or
publication-management policy is implemented. No account-deletion UI is added.

`20261026_remove_project_category.sql` removes the unused project type column.
It preserves project records, technologies, authorship links, and likes.

`20261026_simplify_project_details.sql` removes the redundant summary and makes
the GitHub link required. It fills missing links only for the three named demo
projects with the GitHub homepage. Other existing projects need valid GitHub
links before applying it; their links and all project descriptions are retained.

`20261026_stage1_platform_foundation.sql` creates turmas, membership, Better Auth
tables and invitation/moderation fields, then backfills groups and project turma.
`20261026_stage2_auth_cutover.sql` uses the owner's explicit confirmation that all
existing users are demos: it flags those profiles, discards obsolete credentials /
sessions, and adds durable auth rate-limit storage. It never deletes profiles,
projects, credits or likes. Do not use this demo-only cutover for an unrelated
database containing real accounts. See [Platform foundation](platform-foundation.md).

`fixtures/` contains historical schema definitions for isolated migration tests,
not additional production migrations.

`20261027_stage3_owner.sql` adds the `owner` role and enforces a single owner.
Existing-account promotion uses an explicitly selected active administrator ID;
see [Administration](../docs/administration.md). It is currently applied only to
development and its isolated test copy, not production.

`20261027_turma_details.sql` adds unique turma numbers, course names and start
years. Only numbers are backfilled from existing labels; unknown course/start-year
values remain null, and historical graduation years are retained. New group saves
require all three fields. The guarded development/test runner snapshots all
original rows and verifies that they are preserved. Applied to development and
its isolated test copy only; see [Administration](../docs/administration.md).
