# Project operations

Server pages load initial data and gate access to the editor and personal list.
The API independently authenticates every mutation; hiding a button is never an
authorization check.

| Module | Responsibility |
| --- | --- |
| `components/project-editor.tsx`, `components/my-projects.tsx` | Form/dialog state, validation feedback, notifications, navigation and list refresh. |
| `lib/projects-client.ts` | Typed create/update/delete/leave requests and multipart serialization. Shared `lib/http-client.ts` decodes JSON, HTTP errors and field feedback for projects and accounts. Neither module navigates or owns React state. |
| `app/api/projects/**/route.ts` | Origin/session checks, request parsing, HTTP responses and scheduling post-commit image retirement with Next.js `after()`. |
| `lib/project-mutations.ts` | Authorized project operations, turma/coauthor rules, locked writes and SQL transactions. |
| `lib/validation.ts`, `lib/project-authors.ts` | Shared field validation and transaction-scoped author eligibility/credits. |
| `lib/image-form.ts`, `lib/image-storage.ts` | Bounded HTTP input and image processing/storage/retirement. |

The mutation module is server-side. Its `actorId` is supplied only from the API's
verified session, never from submitted form values. Ownership and coauthorship
are checked against PostgreSQL. No public API or database schema changes are
required by this separation.

Updates accept an input-reading callback so ownership is checked **before**
parsing an oversized or malformed body, preserving existing HTTP behavior. The
callback returns plain input and an optional File; the operation does not depend
on Request, Response, cookies, routing or React. The row is checked again under a
transaction lock before mutation. Missing coauthors/framing retain their existing
semantics; explicit empty coauthors remove credits except the owner's.

Object storage cannot participate in a SQL transaction. `withCoverUpload` removes
a newly uploaded object if the database operation fails. Successful updates and
deletions return the previous image metadata to the route; retirement is scheduled
only after commit. The storage module still checks whether another record refers
to the image before removing it. Existing cover conflict checks, moderation
visibility, author credits, likes and response shapes are preserved.

## Checks

```sh
npm run test:projects
```

The server suite requires `.env.admin-test` on an isolated current-schema Neon
`test/*` branch. Alternatively select an ignored env file explicitly with
`GALLERY_PROJECT_TEST_ENV_FILE`. It verifies the actual database identity before
writes, rejects development/production, creates only its own fixtures and compares
all original rows after cleanup. See [Environments](environments.md).

These characterization tests were run against the original Route Handlers before
extraction and are retained against the same public handlers after refactoring.
They use real PostgreSQL transactions, constraints and row locks. Session lookup,
upload throttling, object storage and Next's post-response scheduling are mocked
at the external boundary: no real cloud objects are uploaded or deleted. Better
Auth and image decoding have separate existing tests.

The client tests cover request formats, field errors, authentication errors,
network failures and invalid/non-JSON responses. They do not replace browser
checks of notifications, dialog behavior and navigation.
