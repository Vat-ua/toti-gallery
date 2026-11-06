BEGIN;
-- Optional personal contact; existing profiles and credentials remain unchanged.
ALTER TABLE gallery_users ADD COLUMN linkedin text;
COMMIT;
