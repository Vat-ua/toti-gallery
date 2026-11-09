# Account operations

`/minha-conta` is a server page that checks authentication and passes the
public profile, email and credential availability to `AccountForm`.

| Module | Responsibility |
| --- | --- |
| `components/account-form.tsx` | Independent profile/password form state, photo preview, feedback, notifications and reauthentication navigation. |
| `components/image-actions.tsx` | Shared change/remove controls for profile photos and project covers; file selection and preview state stay in each form. |
| `lib/account-client.ts` | Typed multipart profile updates and JSON password changes; validates the success fields the UI uses. |
| `lib/http-client.ts` | Shared account/project request and JSON decoding, field errors, network failures and HTTP status errors. It never navigates or stores credentials/tokens. |
| `lib/account.ts` | Pure shared validators for editable profile fields and password input. |
| `lib/account-mutations.ts` | Profile validation, avatar upload compensation, locked profile writes and result construction inside the transaction. |
| `app/api/account/route.ts` | Origin/session checks, bounded input parsing, HTTP responses and post-commit image retirement. |
| `app/api/account/password/route.ts` | Origin/session checks, throttling, validation and delegation to Better Auth. It forwards successful response cookies and preserves wrong-current-password feedback. |

The profile operation accepts only a server-authenticated actor. Submitted IDs,
email, roles and account status are not editable. `getPerson` can use the current
transaction to construct the same public projection as other pages. The API
returns that result after commit, without a second session lookup that could
misreport an already committed update as a failure. Projection failures happen
before commit, so they roll back the update and trigger conservative upload cleanup.

Single-profile lookups by ID or slug use one scoped query with turma memberships,
including profiles with no turma. They share the public projection and primary
turma selection rules with list queries, without loading the entire community.

Profile saves require an `expected` snapshot of the original `name`, `bio`,
`github`, `linkedin` and `avatar`. Missing or malformed snapshots return `400`.
The operation compares these exact values under the user row lock before writing;
a stale snapshot returns `409`. Snapshot validation checks the shape, without
normalizing or applying new-input rules to existing legacy values. Role, status,
membership and auth timestamps are deliberately excluded.

The form retains its original snapshot and draft across server refreshes, advances
the snapshot only after its own successful save, and keeps input/photo selection
on a conflict. Administrative name changes invalidate an older self-profile form;
an admin name/email edit can still proceed after an unrelated biography change.
A rejected uploaded photo follows normal rollback cleanup; a stale removal cannot
delete the currently saved photo. Shared
[image lifecycle](image-storage.md#ownership-and-lifecycle) and
[commit-failure rules](server-reliability.md#database-and-storage-failures) also
apply to profile saves.

Password hashing, credential checks, session replacement and revocation remain
Better Auth's responsibility. The UI keeps its existing 401 redirect to sign-in,
clears password inputs only after success and does not retain returned auth tokens.

## Checks

Use `test:account` with the isolated target described in
[Testing](testing.md#database-integration-suites).

Integration tests use real PostgreSQL, Better Auth, hashing and signed session
cookies. Only Next's request context/post-response scheduling, custom rate-limit
decisions and object storage are controlled. No real cloud images are written.
The suite removes only its own fixtures and checks all original table rows after
cleanup; its temporary SQL failure trigger/function are also removed.

Coverage includes authorization, editable-field limits, response projection,
avatar retention/replacement/removal, upload/SQL failures, concurrent replacements,
required snapshots, cross-entry profile conflicts and unrelated-state changes,
the post-commit session regression, password validation, incorrect current
passwords, throttling, replacement cookies and other-session revocation. Client
tests cover multipart/JSON formats, structured errors, 401, network failures and
malformed success responses. Browser checks separately verify UI interactions.
