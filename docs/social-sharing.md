# Social sharing metadata

Public pages use the Next.js Metadata API through `src/lib/metadata.ts`. Each page
supplies its own title, description and path; the helper includes complete Open
Graph and Twitter Card objects because Next.js does not deep-merge nested metadata.

The root `metadataBase` uses the existing trusted `BETTER_AUTH_URL` deployment
origin, with `http://localhost:3000` as the local fallback. No new environment
variable or hosting integration is required. These tags do not change indexability;
the demo, presentation and other existing `noindex` routes keep their rules.

All pages share `public/social-card.png` (1200 × 630). Its editable artwork is
`public/social-card.svg`; the PNG was rendered using the project's local Instrument
Sans and Instrument Serif fonts. Social previews use the PNG so recipients do not
need the fonts or SVG support. No profile, project, database or account data is
included in the artwork. Per-project sharing images remain deferred.

Descriptions are parsed with the existing CommonMark stack (`unified` and
`remark-parse`, now declared as direct dependencies). They preserve text and link
labels, omit link destinations, HTML, images, code blocks and reference
definitions, normalize whitespace, and shorten to 160 Unicode code points including
an ellipsis where needed. This affects metadata only, not saved descriptions or
their Markdown rendering on the project page.

Local checks cover the parser and metadata composition in `tests/metadata.test.ts`,
plus browser inspection of emitted tags and image loading. Real messaging services
can cache previews and cannot fetch localhost; their final rendering must be
checked after an authorized deployment to a publicly accessible URL.
