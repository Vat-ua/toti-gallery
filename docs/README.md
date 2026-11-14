# Documentation

Choose the guide for the task; reading the entire directory is not a prerequisite
for development. The root [README](../README.md) covers getting started, and
[AGENTS.md](../AGENTS.md) contains project-wide engineering and safety rules.

## Development and operation

| Task | Guide |
| --- | --- |
| Configure targets; review and release changes | [Environments](environments.md) |
| Select and run checks, database suites or browser smoke tests | [Testing](testing.md) |
| Back up or recover the matching database and images | [Backup and restore](backup-and-restore.md) |
| Diagnose failed requests, timeouts and uncertain saves | [Server reliability](server-reliability.md) |
| Review SQL changes and migration-specific instructions | [Migrations](../migrations/README.md) |

## System and feature contracts

| Topic | Guide |
| --- | --- |
| Tables, fields, relationships and deletion behavior | [Database](database.md) |
| Queries, pagination, URL state, rendering and caching | [Data loading](data-loading.md) |
| Sign-in, activation, access links, bootstrap and Google setup | [Authentication](authentication.md) |
| Permissions and administrative workflows | [Administration](administration.md) |
| Administrative operation boundaries and concurrency | [Admin operations](admin-operations.md) |
| Publication operations, repeat-safe creation and edit conflicts | [Project operations](project-operations.md) |
| Profile and password operation boundaries | [Account operations](account-operations.md) |
| Browser-based likes and reconciliation | [Project likes](project-likes.md) |
| Upload processing, storage configuration and file lifecycle | [Image storage](image-storage.md) |
| Sharing metadata, canonical URLs, robots and sitemap | [SEO and sharing](seo.md) |

## Demonstration and presentation

- [Try the demo](../README.md#try-the-demo): experience student workflows without an account.
- [Demo isolation](authentication.md#browser-only-demonstration): guest eligibility,
  browser storage and separation from real accounts.
- [Presentation](presentation.md): presentation visibility and safe screenshot maintenance.

## Archive

Historical records are not current specifications, roadmaps or release approvals.
Read them only when their historical context is relevant.

- [Architecture audit — 2026-11-08](archive/architecture-audit-2026-11-08.md):
  assessment of commit `b3a75f7`; code references point to that snapshot.
- [User stories — archived 2026-11-14](archive/user-stories-2026-11-14.md):
  an earlier feature overview, including implemented and deferred scenarios.

## Maintaining the guides

- Update the relevant guide with changes to behavior, contracts or operating steps.
  Explain current rules and their reasons rather than the history of each edit.
- Keep one primary location for each topic; link to shared environment/test rules.
- Code defines implementation details. Document invariants, limitations and
  procedures that are easy to miss in code; avoid duplicating entire functions.
- Date external verification and deployment observations. A past successful check
  does not establish today's cloud configuration or the status of another commit.
- Keep useful history in Git or a clearly labeled `docs/archive/`. Ignored `tmp/`
  is for disposable/private working material, not the only copy of shared guidance.
  Never commit recovery archives, credentials or bearer links.
