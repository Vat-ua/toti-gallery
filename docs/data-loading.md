# Page data loading

## Responsibilities and contracts

Server pages call scoped readers in `src/lib/queries.ts` directly. Route Handlers
expose the same readers to browser interactions; they select private scope from
the verified session, never from a supplied user ID. Hidden moderation reasons
are returned only to the publication owner.

`GET /api/projects` defaults to the gallery. `view=gallery`, `view=profile&slug=…`
and authenticated `view=mine` use one batch contract. `/api/people` uses the same
contract for community profiles. All responses are `no-store`:

- `CollectionPage`: one batch (`items`, `total`, `page`, `pageSize`, `hasMore`,
  `previousId`). `previousId` identifies the preceding row in that SQL snapshot.
- `CollectionSnapshot`: the cumulative displayed prefix (`items`, `total`,
  `loadedPages`, `pageSize`, `hasMore`). It is not an API batch.

`COLLECTION_PAGE_SIZE` in `src/lib/collection-page.ts` is the shared batch setting
(currently 12). `INITIAL_COLLECTION_PAGES` bounds initial HTML to three batches,
including deliberately large URL pages. Deeper URLs restore remaining batches
progressively in the browser; each API response stays bounded. Detail reads load
one project, and related projects are limited to three.

## Query and navigation rules

Search, filters, sorting and counts run in PostgreSQL. One pure URL parser defines
the same meaning for SSR and API requests. Syntactically valid unknown filters
produce no matches; available choices never silently change a query's meaning.
The gallery supports search, turma, technologies, finals and sorting. Community
supports name/turma and sorting by name (default), published project count or
received likes; profile and personal lists support the page only. Independent
filter-choice and list queries start in parallel. Community selects IDs, totals
and public authorship statistics in one SQL statement, then hydrates only selected
profiles and retains that SQL order. Alphabetical browsing limits candidates before
aggregating; rankings aggregate matching candidates before pagination. Duplicate
owner credits and multiple memberships never multiply counts. Ties use pt-BR name
order and ID. `sort=projects` and `sort=likes` persist in community URLs; default
name order needs no URL parameter. Sort changes reset the displayed prefix.
Publication forms load available turmas and their eligible coauthors independently;
private edit reads still wait for verified identity and ownership.

The gallery's turma filter matches the publication's stored turma. Its choices
come only from published projects, including archived turmas. Changing an author's
preferred turma or memberships does not reclassify their existing projects.
Community turma filtering instead follows current memberships; profile project
lists follow authorship regardless of membership changes.

Project lists select card fields and hydrate only their authors in the same SQL
round trip. Descriptions, editor versions, repository URLs and storage metadata
are omitted. Community statistics aggregate published authorship for selected
people, without duplicating owners or memberships. Bound parameters preserve
literal, accent-insensitive search; sorts have stable ID tie-breakers.

Lists use live OFFSET pagination, not a database snapshot lasting across requests.
The client validates totals, adjacent boundaries and duplicate IDs before appending.
Detected drift rebuilds the requested prefix, retaining prior cards until the repair
is complete. Repeated drift stops with a recoverable error. `hasMore` determines
the end independently of the number of locally rendered cards. Changes wholly
inside an already loaded portion are visible after a refresh; this is not realtime.

`usePagedCollection` owns URL/read lifecycle; `loadCollection` owns batch assembly.
Obsolete requests are aborted and ignored, failures retain loaded data, and retry
resumes from the last accepted batch. Going back to a smaller loaded prefix needs
no request. Initial, empty, updating and failed states remain distinct. Demo lists
have no remote endpoint and retain their independent IndexedDB operations.

## Freshness and caching

React `cache()` deduplicates identity, project and profile reads within one server
render, including metadata. Sessions, permissions, visitor likes and hidden data
have no shared persistent cache. Authorization still checks current DB state.

Better Auth uses Drizzle relation metadata to read a session with its current user
in one query. The application separately reads the active account's role and profile
with memberships in one query, rejecting suspended, pending, unverified and demo
accounts. These are live reads, not a persistent permission cache. Account editing
reuses the request's verified session email rather than selecting the same user again.
The ORM relations require no database migration.

The root starts a request-scoped public identity result without awaiting it.
Header account state and the footer have independent Suspense boundaries.
`getPublicIdentity` distinguishes a confirmed guest/account from unavailable
identity; its failure state is presentation data, never authorization. The header
offers retry, public content remains visible and demo intent is inactive when
identity is unavailable. Demo admission still requires confirmed guest identity.
Private pages and mutations retain the strict `getCurrentUser` checks.

Public publication links reuse that same identity through a small context. Once
resolved, guests go directly to login with the editor as their return destination;
signed-in users go to the editor and demo users to the local demo form. Their
identity boundaries never wrap the page. While pending, links retain the guarded
editor URL with prefetch disabled; unavailable identity also retains that protected
destination. No additional session API request is needed.
The editor and its API continue to authorize every request on the server.

Public pages use the verified session identity to rule out ownership without waiting
for the full account profile. Owners still pass the complete live account check before
rendering edit controls. Only ownership-dependent actions/empty-state copy await
that check under small boundaries; identity failure closes those controls without
blocking public data. Related
projects stream independently after the primary project. Profile project/statistics
reads start as soon as the person is known, concurrently with the ownership check.
These boundaries use no new loading designs or minimum display timers.

About and presentation content likewise does not await account availability.
An optional demo invitation is shown only for a confirmed guest; unavailable
identity never advertises or activates demo as a substitute for authentication.

Local pools retain idle connections for one minute to avoid reconnecting after short
reading pauses. Vercel keeps its existing ten-second idle timeout and pool lifecycle
attachment. Network latency, cold connections and hosted compute behavior remain
separate from SQL execution time.

Public likes include the SQL statement's observation time, in PostgreSQL epoch
microseconds. List/detail reads and like operations use the same database clock.
The browser controller accepts newer idle snapshots, ignores older prefetches and
protects in-flight actions. Local demo controllers remain scoped separately.
This orders observations; it does not turn likes into a realtime subscription.

Main navigation prefetches gallery/community routes in production. Card covers
and community profiles prefetch on hover/focus instead of eagerly loading every
visible destination. Immutable image URLs use long-lived image caching.

## Verification

Read integration tests require an explicitly verified isolated test DB; their
fixtures roll back. Unit tests cover contracts, parsing, batch reconciliation and
like freshness. Playwright covers actual SQL batches, deep reloads, history,
network retry, stale responses, live-list drift, covers, access and CRUD at desktop
and mobile widths. CI uses a disposable PostgreSQL service without cloud secrets.
