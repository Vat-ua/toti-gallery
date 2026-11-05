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

Turma detail reads select only enrolled profiles and their other memberships.
Candidate profiles use the same bounded server search from both entry points.
Student and project listing keep their existing pagination/loading behavior.

Import preview does not create records. Confirmation reparses and validates the
selection, orders email locks, locks eligible existing users and rechecks their
current state. New users, slug allocation and membership inserts are batched in
one transaction. An error rolls back the whole import; existing identities are
preserved and retries do not create duplicates. Batch and individual provisioning
share the same slug-allocation lock. Limits remain 500 rows and 200 KB of CSV;
administrative JSON requests are limited to 250,000 bytes during stream reading.

## Validation

Run `npm run test:admin` against an isolated current-schema Neon test branch.
Select an ignored env file with `GALLERY_ADMIN_TEST_ENV_FILE`; profile tests in the
same command accept `GALLERY_PROFILE_TEST_ENV_FILE`. Both default to
`.env.admin-test` when no override is given. Every database suite verifies its
actual target before writing, removes its fixtures and checks original rows.

The suite includes staff/owner permissions, conflicting memberships, concurrent
self-management, grant lifecycle, moderation, import rollback/identity preservation,
and HTTP/client response handling. HTTP unit tests replace authentication;
student-route integration tests replace only the authentication boundary and use
the real operation/database for missing, malformed, stale and current snapshots.
Server-operation integration tests exercise real PostgreSQL transactions and locks.
See [Environments](environments.md) for database and release rules.
