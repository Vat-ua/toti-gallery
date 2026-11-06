# Server reliability and diagnostics

## Database and storage failures

Project creation/updates and profile updates share `commitImageChange`.
It distinguishes a failure inside the transaction callback from a failure after
that callback completed, when PostgreSQL may already have committed.

- Before COMMIT can start, retirement checks both profile and project references
  before deleting the new upload. If either lookup fails, keep the file.
- Once COMMIT can have started, retain the new upload even if a new lookup would
  find no reference: an in-flight commit may not yet be visible. Return a safe
  `503` explaining that saving could not be confirmed and asking the user to
  check the result before retrying. Do not retry a write automatically.
- Replaced images are still retired with Next.js `after()` only after an
  acknowledged commit. Cleanup failures do not turn that successful save into an
  HTTP error. These tasks are best effort, not a durable queue.

The conservative policy can leave unreferenced objects. They require later
maintenance; it is preferable to deleting a file that a committed record uses.
This stage does not implement garbage collection or coordinated backups.

## Connections and deadlines

`database-pool.ts` keeps the existing `pg`/Drizzle driver and configures:

| Setting | Value | Purpose |
| --- | --- | --- |
| Maximum connections per pool | 5 | Bound each function instance's connections |
| Connection / pool acquisition timeout | 10 seconds | Allow Neon wake-up without waiting indefinitely |
| Idle connection timeout | 10 seconds | Release unused connections |
| Connection maximum lifetime | 300 seconds | Periodically renew connections |
| PostgreSQL statement timeout | 30 seconds | Cancel individual expensive statements |
| Client query timeout | 35 seconds | Bound waiting if the connection stops responding |
| PostgreSQL lock timeout | 10 seconds | Bound lock contention |
| Idle transaction timeout | 60 seconds | Avoid abandoned open transactions |

These are initial operational limits, not a whole-request deadline or performance
measurements. Import batches retain their transaction and can execute multiple
bounded statements. Network failures and canceled writes can still have an
uncertain outcome. Adjust limits from observed timings, without blind write retries.

A pool error listener records background connection errors without an unhandled
EventEmitter error. On Vercel, `attachDatabasePool` handles idle connections before
Fluid Compute suspension. Local development does not install that lifecycle hook.
Use the existing branch-specific pooled Neon connection for application traffic.

S3 operations have a 10-second connection timeout, a 20-second request timeout,
and at most two SDK attempts. SDK retries target unique-key object operations;
SQL mutations are not automatically retried.

## HTTP and user feedback

Only `PublicError` and `FormValidationError` carry application-approved messages
across the HTTP boundary. Field feedback, authorization errors, throttling and
conflicts retain their explicit statuses. Unexpected exceptions return a generic
`500`; recognized dependency/network/lock failures return `503`. Failure responses
are not cacheable. Unexpected-error JSON includes an opaque `requestId`, also in
`X-Request-Id`; `503` responses include `Retry-After`, not an automatic retry policy.

Session lookup and throttling are included in the API error boundary. Better Auth
continues to own credentials, hashing and cookies; the password route preserves
successful replacement cookies and wrong-current-password field feedback.

Activation input is limited to 2,048 bytes; password changes to 8,192 bytes to
accommodate JSON escaping. Both use the existing streaming byte limiter, enforce
the limit without trusting Content-Length, and return `413` before credential
operations. Malformed JSON returns a safe `400` without echoing input.

`error.tsx` and `global-error.tsx` use the same recovery UI, including the root-layout
failure case. Next.js `retry()` refetches the failed content. An opaque digest can
be used to correlate rendering failures with server logs. The gallery link performs
a full navigation so recovery does not depend on the failed router tree.

## Logs in Vercel

Server failures emit one JSON object per line through `console.error`; no external
logging service is required. Search Runtime Logs by `event`, `operation`,
`requestId`, `digest`, `code` or `fingerprint`.

Examples of events: `request.failed`, `database.pool.error`,
`image.commit.unconfirmed`, `image.retirement.deferred`, `image.delete.failed`,
`image.read.failed`, `image.stream.failed`, `health.database.failed`,
`auth.library.failed`, and `next.request.failed`.

Logging uses an explicit allowlist. It never serializes request headers, bodies,
URLs, emails, credentials, raw error messages/stacks, SQL or driver parameters.
Known error codes and categories are retained; a one-way stack fingerprint groups
otherwise unknown errors. Better Auth's error logger uses this same policy.
Next.js `onRequestError` captures uncaught framework/server-rendering failures;
handled API failures are logged at their HTTP boundary. Expected input failures
are not logged as server failures. Framework/platform logs remain outside this
application logger's control. This is technical diagnostics, not an admin Audit Log.

## Verification

`npm run test:resilience` runs deterministic failure tests without database or cloud
writes: lost COMMIT acknowledgement, an unobservable commit, failed reference
checks/deletes, partial upload, pool background errors, private error responses,
streamed byte limits, dependency failures and safe recovery markup.

Project/account integration suites additionally commit real fixture transactions
on an explicitly verified isolated `test/*` database, then inject a lost response
from `transaction()` to verify that records/credits and image references survive.
Storage is controlled: no real images are uploaded/deleted. These tests do not
claim to reproduce a real Neon network partition or Vercel suspension.

Production schema was inspected on 2026-11-05 using SELECT-only queries inside a
READ ONLY transaction, after verifying its Neon target. `gallery_users` lacks
`slug`, `primary_turma_id`, `linkedin` and the corresponding profile indexes.
Before releasing this branch, verify/apply `20261104_public_profiles.sql` and
`20261104_profile_linkedin.sql` under the existing approval/recovery procedure.
No production migrations were applied during this stage.
