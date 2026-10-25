# Database migrations

For a new, empty database, follow the root README and create the current schema
with Drizzle. The development seed includes the owner in each project's authors.

For an existing database, apply pending `.sql` files in filename order using a
PostgreSQL client or SQL editor connected to the intended database. They are not
applied automatically when the application starts. Schema synchronization alone
does not replace the authorship data backfill.

`20261026_add_project_authors.sql` adds authorship links and backfills existing
owners without changing project records. Deleting a project removes its links
and likes; deleting a coauthor removes only that person's links. An account that
owns publications cannot be deleted until an explicit ownership-transfer or
publication-management policy is implemented. No account-deletion UI is added.

`20261026_remove_project_category.sql` removes the unused project type column.
It preserves project records, technologies, authorship links, and likes.
