# SEO and sharing metadata

## Page metadata and social previews

Public pages use the Next.js Metadata API through `src/lib/metadata.ts`.
`sharingMetadata` receives each page's title, description and path, and supplies
complete Open Graph/Twitter Card objects because nested metadata is not deep-merged.
The trusted `BETTER_AUTH_URL` origin supplies absolute URLs; local fallback is
`http://localhost:3000`. No separate SEO service or environment variable is needed.

All pages share `public/social-card.png` (1200 × 630). Its editable artwork is
`public/social-card.svg`, rendered with the project's local fonts. Social previews
use the PNG and contain no account/database content. Per-project social images
are not implemented.

Descriptions use the existing CommonMark parser to retain text/link labels,
omit HTML, images, code blocks, reference definitions and link destinations,
normalize whitespace, and shorten to 160 Unicode code points including an
ellipsis when needed. This does not change saved Markdown or page rendering.

## Canonical URLs and crawling

Public pages supply their own canonical URL. Gallery/community query variants
use their base path; project/profile pages use their encoded slug. Root metadata
omits a canonical so private or unknown pages cannot inherit the home URL.

`src/app/robots.ts` serves `/robots.txt`, permits HTML crawling, excludes `/api/`
and advertises the sitemap. Sign-in, activation, account, administration, local
demo and presentation pages use `noindex` and omit canonical URLs. They are not
blocked in robots.txt, allowing crawlers to read that metadata. Neither robots.txt
nor `noindex` provides authorization or guarantees search-engine behavior.

## Dynamic sitemap

`src/app/sitemap.ts` serves `/sitemap.xml` dynamically. Each request reads current
public records; publication, activation, membership and moderation changes need
no scheduled generation or new deployment.

It includes:

- `/`, `/comunidade` and `/sobre`;
- published projects, using stored `updated_at` for `lastmod`;
- community-eligible profiles: verified-email or database-demo profiles with at
  least one membership, regardless of role. Archived turmas remain eligible;
  multiple memberships produce one URL.

It excludes hidden projects, unverified non-demo profiles, people without a turma,
non-indexable service pages, APIs and query variants. No email, role, moderation
data or visitor-specific likes are emitted. Static/profile timestamps are not
invented: one profile timestamp does not capture changes to all displayed projects.

`getSitemapRecords` uses two narrow projections, not the hydrated gallery. DB errors
propagate instead of returning a successful but incomplete empty sitemap.

## Verification

`tests/metadata.test.ts` covers descriptions, metadata and crawler configuration
without a DB. `test:sitemap` verifies inclusion/exclusion and requires an isolated
database; CI runs it after disposable smoke setup. Browser smoke tests exercise
XML, canonical/noindex rules and publication/deletion changes. Setup and target
requirements live in [Testing](testing.md#database-integration-suites).

After an approved public deployment, inspect affected page tags and image URLs.
Messaging services cache previews and cannot fetch localhost, so their final
rendering must be checked on the actual public URL.
