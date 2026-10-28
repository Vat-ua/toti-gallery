# Image storage

User uploads use the existing `gallery-images` Neon Object Storage bucket.
Development and production must use their respective branch endpoints and
credentials. Static images shipped in `public/`, existing data URLs, external
cover links and generated covers continue to work; this change does not bulk
migrate existing images.

## Processing and display

- Accept JPEG, PNG and WebP up to 3 MiB. The server decodes and validates the file;
  filename/MIME alone are insufficient. Animated images and images exceeding
  25 megapixels are rejected.
- Profile photos are cropped to a centered square and resized to at most
  512 × 512. The editor previews the same centered crop with a round mask.
- Covers retain their aspect ratio, fit within 1600 × 1600, and get a second
  version up to 640 pixels wide for cards. Horizontal 7:5 is recommended, not
  enforced. Both uploaded and generated covers use 7:5 frames in cards/editor
  previews and a wider 16:10 frame on project detail pages, on desktop and mobile.
  Display crops can therefore differ; the stored image is not cropped.
- The preview's `Cartão` and `Página` controls show those two frames. `Ajustar
  enquadramento` enables pointer/touch dragging, arrow-key movement (Shift moves
  faster), and 100–300% zoom. Reset restores the previous default (top-center,
  100%); Cancel/Escape restores the settings from before this adjustment session.
  Done exits adjustment mode; the project form's Save persists the settings.
  Both previews use the same position/zoom, so authors can check both crops.
- WebP output uses quality 84 (82 for the card thumbnail), preserves alpha,
  applies EXIF orientation and strips source metadata. Images are never enlarged.
  Original full-resolution files are not retained.
- Files upload only when the form is saved. Selecting/replacing a file changes a
  temporary local preview. Canceling the form writes no objects.

PostgreSQL stores a branch-independent `/media/<object-key>` reference and
server-generated JSON metadata in `gallery_users.avatar_metadata` or
`gallery_projects.image_metadata`: key, width, height, bytes, format, and optional
thumbnail metadata. No new image bytes are written to PostgreSQL.

`gallery_projects.cover_framing` stores `{x, y, zoom}` independently of the file.
Changing the frame does not upload or rewrite any object. It applies to stored,
external and legacy image covers; generated covers retain their own composition.
The larger existing image is used for zoomed cards to avoid enlarging a thumbnail.
Replacing/removing an image resets its frame; older API clients that omit the
setting preserve it when retaining the same image. The API validates all values
and editing continues to require publication ownership.

The `/media/...` route streams the selected branch's object with immutable cache
headers so Vercel can cache it. Each replacement has a new random key. Covers
use the thumbnail in cards and the larger version on the detail/editor page.

## Setup

Apply the reviewed metadata migration on an isolated test copy, then development;
see [Environments](environments.md). Credentials explicitly have both
`storage:read` and `storage:write`, and are anchored to development, not its
production ancestor.

Apply `20261028_cover_framing.sql` after the image metadata migration, using
`node scripts/migrate-image-storage.cjs --framing --env-file=<ignored-env-file>`.
The same development/test-only target and data-preservation checks apply.
Keep them server-only in ignored `.env.local`; see `.env.example` for names.
The app checks the storage endpoint's branch and verifies the actual SQL target
before object writes/deletes. Do not blindly pull Neon env over existing database
or Better Auth configuration.

Production rollout is separate: review/apply pending schema migrations, create a
production storage credential, configure its storage variables in Vercel, then
deploy with approval. Do not reuse development credentials or publish them with
a `NEXT_PUBLIC_` prefix. Normal profile/project edits without new uploads continue
to work when storage credentials are absent.

## Ownership and lifecycle

Uploads require an active authenticated account and the configured trusted
origin. Cover changes also require publication ownership. Clients cannot adopt
another upload's managed key. Uploads are limited per account, request streams
are bounded before parsing, and originals are decoded with a pixel limit.

The database update commits after successful processing/upload. A failed database
write removes the new upload. Replacement, removal and project deletion retire
the previous managed object after commit, once it is no longer referenced.
Legacy/external images are never deleted. Failed cleanup is logged without
credentials and may leave an unreferenced file for later maintenance.

`gallery-images` is public-read. Image URLs are public: hiding a project removes
its publication from public pages, but is not a revocation of a previously shared
image URL or cached copy. Private documents do not belong in this bucket.

## Checks

`npm run test:images` exercises decoding, sizes/crops, EXIF removal, alpha,
invalid/oversized files, bounded multipart parsing, legacy-image preservation,
and storage-branch configuration without connecting to a database. API/browser
write checks additionally require an explicitly selected temporary `test/*`
branch with its own SQL/storage endpoint, never development or production.
