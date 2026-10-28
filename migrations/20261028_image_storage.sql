BEGIN;
-- Existing image URLs/data and all other fields remain unchanged.
ALTER TABLE gallery_users ADD COLUMN avatar_metadata jsonb;
ALTER TABLE gallery_projects ADD COLUMN image_metadata jsonb;
COMMIT;
