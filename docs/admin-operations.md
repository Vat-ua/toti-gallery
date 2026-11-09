# Administration operations

Server pages authenticate the visitor and load authorized data for the current
section. Components own form state, feedback and navigation. Route handlers
validate request shape and delegate to the existing feature operations.

| Module | Responsibility |
| --- | --- |
| `lib/admin-client.ts` | Typed browser operations and validation of the response fields each form uses. Shares transport/error handling with account and project clients. |
| `lib/admin-http.ts` | Origin/session checks, bounded JSON input, HTTP status/error responses and private unexpected-error messages. |
| `lib/admin-server.ts` | Transaction-scoped staff authorization and shared administrative errors. |
| `lib/admin-turmas.ts` | Turma changes, membership operations, scoped reads, atomic student import and turma-scoped access links. |
| `lib/admin-students.ts` | Student identity, memberships, suspension, pending-registration deletion and access links. |
| `lib/admin-projects.ts` | Authorized project reads and visibility moderation with expected-state checks. |
| `lib/admin-administrators.ts` | Owner-only administrator provisioning, promotion, removal and access links. |
| `lib/access-links.ts` | Single-use grants, activation and credential handling; delivery remains independent. |

## Consistency and access

Administrative writes recheck the actor's current role/status in the transaction.
The authorization row remains locked for that transaction; self-management takes
an update lock immediately to avoid concurrent shared-lock upgrades. Rejected
operations avoid locking other protected staff rows unnecessarily. Administrator
promotion/removal retains its existing session and grant revocation rules.

Replacement forms also submit exact original values in `expected`:

- Student `profile`: `name` and `email`. Compare under the existing target user
  lock, including changes made through self-service. Bio/photo changes do not
  conflict because this operation does not replace them.
- Turma `save`: `number`, `courseName` and `startYear`. Compare under a turma
  update lock. Legacy null course/year values remain valid snapshot values;
  new submitted values still follow the current validation rules.

Both operations require the snapshot even for direct server calls that edit an
existing record. Missing/malformed snapshots return `400`; stale values return
`409` before any write or grant revocation. Creation needs no snapshot. Archive,
suspension and membership commands retain their independent semantics.
Forms preserve drafts and original snapshots across background refreshes; a
successful save advances the baseline or closes the form. Conflicts ask the
administrator to copy their changes and reload instead of silently retrying.

HTTP requests for the student `turmas` action require an `expected` snapshot
containing `turmaIds` and `primaryTurmaId`, in addition to the existing fields.
Missing or malformed snapshots return `400`. The operation compares a valid
snapshot after locking the student and returns `409` if another operation changed
it. The form keeps its original snapshot across background refreshes and adopts a
new snapshot only after its own successful save.

The internal `updateStudentTurmas` operation retains an optional snapshot for
trusted direct server calls and fixture setup. HTTP callers cannot opt out of
the check; no request flag enables unconditional replacement. Membership changes
preserve project authorship and existing publications.

Turma access links check group membership and account eligibility within the same
transaction that creates the grant. A separate list read cannot authorize it.

## Reads and imports

Turma choices for filters and forms omit membership/publication counters. The
Turmas list computes its counters in the same SQL statement as the groups.
Turma detail headers retain both counts; the Projects tab does not read member
profiles. Its header and projects start concurrently after authentication.
Candidate profiles use the same bounded server search from both entry points.

Project lists select card fields and hydrate authors/like counts in the same SQL
round trip. SSR restores at most three shared batches. The staff-only
`GET /api/admin/projetos` returns one `CollectionPage`, including its preceding
boundary ID. `usePagedCollection` reuses the public list's abort, retry, history,
and live-list reconciliation behavior with the administrative URL parser.
Search, turma and visibility changes use browser history and bounded API reads;
loading more does not rerender the server page or reload earlier batches.
Moderation still refreshes the current server snapshot. Detail reads retain the
full project and moderation context.

Students remain paginated at 25/50. Counts, selected students, their memberships
and latest relevant grant metadata share one SQL statement for normal pages.
Out-of-range pages perform a bounded fallback count and read. Administrative
read transactions retain live staff checks and consistent list snapshots;
transaction-scoped write authorization and locks are unchanged. No persistent
permission or private-data cache is used.

Import preview does not create records. Confirmation reparses and validates the
selection, orders email locks, locks eligible existing users and rechecks their
current state. New users, slug allocation and membership inserts are batched in
one transaction. An error rolls back the whole import; existing identities are
preserved and retries do not create duplicates. Batch and individual provisioning
share the same slug-allocation lock. Limits remain 500 rows and 200 KB of CSV;
administrative JSON requests are limited to 250,000 bytes during stream reading.

## Validation

Select `test:admin` and its isolated fixture target through
[Testing](testing.md#database-integration-suites). Tests verify their actual
target before writing, remove their fixtures and check original rows.

The suite includes staff/owner permissions, conflicting memberships, concurrent
self-management, grant lifecycle, moderation, import rollback/identity preservation,
and HTTP/client response handling. HTTP unit tests replace authentication;
student-route integration tests replace only the authentication boundary and use
the real operation/database for missing, malformed, stale and current snapshots.
Server-operation integration tests exercise real PostgreSQL transactions and locks.
See [Environments](environments.md) for database and release rules.
