BEGIN;
-- Null keeps the existing top-center placement at the original scale.
ALTER TABLE gallery_projects ADD COLUMN cover_framing jsonb;
COMMIT;
