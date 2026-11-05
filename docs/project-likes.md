# Project likes

## Identity

Likes remain anonymous and independent of authentication: one row per
`(project_id, visitor_key)`. Signing in or out does not change that identity.
Existing `toti_visitor` cookies and likes are preserved.

Before the first write in a page, the client creates or reads one opaque UUID in
IndexedDB (`toti-gallery`, store `visitor`). A read/write transaction makes first
creation atomic across tabs. `/api/visitor` establishes the corresponding HttpOnly,
SameSite=Lax cookie without writing to PostgreSQL. An existing cookie takes
precedence and is adopted into IndexedDB. An unsuccessful bootstrap can be retried
without creating any likes. If IndexedDB is unavailable, browsers supporting Web
Locks serialize cookie-only bootstrap instead. If neither facility is available,
the button reports that browser storage must be allowed; it does not create
unstable identities or write a vote.

Only the UUID is stored locally, not credentials or project data. Clearing cookies
alone can restore the same identity from IndexedDB. Clear the site's cookies and
IndexedDB data to reset it. Different browser profiles/devices have separate IDs;
this does not enforce one like per person or provide a tamper-proof voter identity.

## API and transactions

- `POST /api/visitor`: bounded identity bootstrap, same-origin only.
- `POST /api/projects/:id/like`: bounded `{ "liked": true | false }`, same-origin,
  with an established visitor cookie. Missing identity returns `409`; malformed
  input `400`; oversized input `413`. Legacy empty-body toggle requests are rejected.
- `GET /api/projects/:id/like`: current state and total, no writes or quota charge.

Responses containing visitor state use `Cache-Control: no-store`.

Mutations lock the published project row in a SQL transaction, apply the desired
state, and count likes before committing. A repeated `true` inserts at most one
row; repeated `false` safely removes an absent row. Other browser identities and
the existing demo base count remain independent. The lock coordinates concurrent
likes, moderation and deletion without adding columns or a new table.

Opposite concurrent requests are ordered by acquisition of the database lock;
there is no global ordering by human click time between independent tabs/devices.
A reconciliation read takes a shared project lock and then a fresh SQL snapshot,
so it waits for an already-running mutation instead of reading pre-commit state.

## Client interactions and failures

Buttons for the same project in one document share a controller. Clicking remains
available during a request: the heart/count update optimistically and rapid
clicks are coalesced into the latest desired state. Each controller sends only one
write at a time, so an earlier response cannot override a later click. Pending
server props do not replace an active local action. This is not live cross-tab
synchronization; refresh another tab to see actions performed elsewhere.

On a network error, malformed success response or server failure, the client
reads the actual state. If it matches the requested state, the action succeeded;
otherwise it reports the failure with the latest confirmed result. If reading
also fails, it restores the last confirmed UI state and permits a later retry.
There is no infinite or blind mutation retry. A completely disconnected client
cannot determine whether an earlier request committed until it reconnects.

## Rate limit

The existing durable PostgreSQL limiter permits 60 mutation requests per browser
in a 60-second window, across all projects, including unlikes and repeated writes.
Requests above that limit return `429`, a Portuguese message and `Retry-After: 60`,
before the project transaction. A later request works once the window expires.

No IP limiter is added for the prototype: shared classroom IPs and another SQL
counter per request outweigh the limited extra protection for an anonymous
informational metric. The browser limit reduces accidental/automated repetition;
it does not stop a determined client from manufacturing new visitor identities.

## Checks

`npm run test:likes` includes client/controller/HTTP tests without a database and
real SQL concurrency/limiter tests. The SQL suite requires a verified isolated
`test/*` branch, selected with `GALLERY_LIKES_TEST_ENV_FILE` (default
`.env.admin-test`). It removes only its fixtures and verifies all original table
rows after cleanup. It never uses development or production for write tests.

Browser checks exercise the actual React components and IndexedDB with controlled
HTTP responses: rapid clicks, duplicated buttons, lost responses, offline recovery,
429 feedback, and simultaneous first visits in two tabs, on desktop/mobile. These
checks do not claim real-time synchronization between documents or a full network
partition test against Neon/Vercel.
