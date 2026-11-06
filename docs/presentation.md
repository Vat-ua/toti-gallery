# Project presentation

`/apresentacao` is a temporary public presentation, separate from `/sobre` and
available by direct link and under `Conhecer` in the footer. It has no link in the header navigation. Its metadata
requests no indexing; that is not access control. Only public architecture and
synthetic examples belong here.

Set the server environment variable `GALLERY_PRESENTATION_ENABLED=false` to return
the normal not-found page and hide its footer link. The presentation is enabled when the variable is absent.
Restart local development or rebuild/redeploy after changing it. Public screenshot
assets remain public even when the route is disabled; they contain no private data.

The four tabs support keyboard navigation and URL hashes. Screenshots can be
enlarged in a native modal dialog. The database graphic is a simplified view of
six core tables, based on `src/db/schema.ts`, rather than a live database viewer.

## Screenshots

`public/presentation/` contains WebP captures of the actual gallery, editor,
project/profile pages and four administrative sections. Records and identities
are fictional; `example.invalid` addresses are intentionally unusable. Capture
used an isolated local source snapshot, with synthetic page props, no database
connection and blocked API requests. No administrator capabilities are exposed
through the presentation itself.

When screenshots need updating, recapture the existing components in an isolated
local fixture environment. Never use production accounts, tokens, activation
links, real email addresses or private project content. Keep image dimensions in
sync with the presentation component and inspect the files before committing.
