# Sitemap

`src/app/sitemap.ts` serves `/sitemap.xml` using Next.js's metadata route. It is
explicitly dynamic: each request reads the current database, so publishing,
activation, membership changes and moderation do not require another deployment.
There is no scheduled generation or static export to update.

The sitemap includes:

- `/`, `/comunidade` and `/sobre`;
- published projects, with their stored `updated_at` as `lastmod`;
- profiles eligible for Comunidade: verified-email or demonstration profiles
  belonging to at least one turma, regardless of role. Multiple memberships
  produce one URL; archived turmas remain eligible.

Pending, unverified non-demo profiles, profiles without memberships and hidden
projects are excluded. Sign-in, activation, personal-account and administrative
pages, local demo pages, presentation pages, API routes and filter/query variants
are not listed. Only public URLs and project modification timestamps are emitted;
emails, roles, account IDs and moderation details are not exposed.

Absolute URLs use the same trusted `BETTER_AUTH_URL` origin as sharing metadata,
with `http://localhost:3000` as the local fallback. There are no invented current
timestamps for static pages or profiles: a user's timestamp alone does not track
all changes to the projects displayed on their profile.

`getSitemapRecords` uses two small database projections rather than loading the
personalized gallery, likes or profile descriptions. Database errors propagate
to the existing server error handling; an incomplete sitemap is not returned as
a successful empty result.

## Crawling and canonical URLs

`src/app/robots.ts` serves `/robots.txt`, allows HTML pages to be crawled, excludes
`/api/`, and advertises the sitemap at the same trusted origin. Sign-in,
activation, personal-account, administration, demo and presentation pages use
`noindex`. They are not blocked in robots.txt, so crawlers can read that metadata.
Neither robots.txt nor `noindex` replaces server-side authentication/permissions.

Public pages set their own canonical URL through `sharingMetadata`. The gallery
and community use their base paths, including when query parameters change search,
filters, sorting or the cumulative "load more" view. Project and profile canonical
URLs use their own encoded slugs. These match the URLs listed in the sitemap.
The root layout deliberately omits a canonical URL, so private routes and unknown
pages cannot inherit the home URL. Non-indexable pages also omit canonical URLs.

Sitemap inclusion and canonical metadata are discovery/consolidation signals,
not guarantees of indexing or a particular search-engine crawling schedule.

Run `npm run test:sitemap` against an explicitly configured isolated test
database (default `.env.admin-test`, override with `GALLERY_SITEMAP_TEST_ENV_FILE`).
The suite verifies the actual target before writes and rolls fixtures back.
CI runs it against the disposable local PostgreSQL service after smoke setup.
The existing browser smoke suite also checks the XML endpoint and changes after
publishing/deleting a project, using its disposable database only. It verifies
robots.txt, per-page canonical URLs (including filtered gallery/community URLs)
and the absence of canonical URLs on non-indexable service pages. Metadata unit
tests cover the shared canonical configuration and crawler rules without a DB.
