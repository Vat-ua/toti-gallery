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
are checked against PostgreSQL.

Updates accept an input-reading callback so ownership is checked **before**
parsing an oversized or malformed body, preserving existing HTTP behavior. The
callback returns plain input and an optional File; the operation does not depend
on Request, Response, cookies, routing or React. The row is checked again under a
transaction lock before mutation. Missing coauthors/framing retain their existing
semantics; explicit empty coauthors remove credits except the owner's.

Successful updates/deletions return retired image metadata to the route for
post-commit cleanup. [Image storage](image-storage.md#ownership-and-lifecycle)
defines file ownership; [Server reliability](server-reliability.md#database-and-storage-failures)
defines rollback and uncertain-COMMIT handling.

## Checks

`test:projects` exercises the real Route Handlers, PostgreSQL transactions,
constraints and row locks. Select the isolated target through
[Testing](testing.md#database-integration-suites). Session lookup,
upload throttling, object storage and Next's post-response scheduling are mocked
at the external boundary: no real cloud objects are uploaded or deleted. Better
Auth and image decoding have separate existing tests.

The client tests cover request formats, field errors, authentication errors,
network failures and invalid/non-JSON responses. They do not replace browser
checks of notifications, dialog behavior and navigation.

## Safe saves

`POST /api/projects` requires a UUID v4 `requestId` in the form's JSON data.
The editor retains it across retries, and in owner-scoped `sessionStorage` until
an acknowledged success. A confirmed existing/deleted publication also clears
the stored key so a fresh form can start another attempt; the open form keeps its
original key and never silently creates a second project. Only this opaque identifier is stored, not a draft or
image. With storage blocked, it remains stable while the editor stays mounted.

A creation receipt in `gallery_project_creations` commits atomically with the
project and authors. Its `(author_id, request_id)` primary key serializes
concurrent attempts. A SHA-256 fingerprint binds it to the normalized fields,
authors, turma, image bytes/type and framing. Identical retries return the same
project without overwriting subsequent edits. Changed content under an already
committed key returns `409` and a link to inspect that publication. Deleted
publications retain receipts and return `410`; a replay cannot recreate them.
There is no receipt expiry in this small prototype.

Ordinary replays skip image uploads. Simultaneous first requests can both upload
before the SQL transaction; the loser retires its unreferenced cover after a
confirmed commit. Storage/network work stays outside row-lock transactions.
Rollback and uncertain-COMMIT image preservation follow
[Server reliability](server-reliability.md). An unconfirmed commit can leave an
orphan, which is preferable to deleting a potentially referenced image.

`PATCH /api/projects/:id` requires a positive integer `expectedVersion`.
The server checks it before upload and again under the project row lock. A stale
editor returns `409`, without changing content/authors or retiring the saved
cover. Successful edits increment `version`; leaving coauthorship also increments
it so an open editor cannot silently re-add the departing author. Likes and
moderation do not increment the content version: edits preserve those fields.
Missing/malformed guards return `400`; none of these checks are optional on the
student API. A lost update acknowledgement may require inspecting the saved
project; the client does not blindly repeat writes or merge changes.

Errors keep the open editor's fields, selected File and framing. Conflict feedback
links to the saved project in a new tab. The dirty-form guard covers same-tab
links throughout the page and native reload/close warnings; cancellable
same-document Back/Forward is also guarded where the Navigation API is supported.
It never rewrites Next.js history. Browser unload prompts are browser-controlled
and cannot guarantee protection on mobile termination or older browsers'
same-document history navigation. This is not persistent draft storage.

Save guards depend on the version/creation-receipt schema; see
[Migrations](../migrations/README.md) before an upgrade. The suite covers HTTP guard
validation, parallel creates/edits, coauthor departure, lost acknowledgements and
cover retirement, and verifies that unrelated fixture data remains unchanged.
