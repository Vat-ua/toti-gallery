-- Project technologies describe the work; the redundant type is no longer used.
-- Keep every project and all other fields, authorship links, and likes intact.
BEGIN;

ALTER TABLE "gallery_projects" DROP COLUMN IF EXISTS "category";

COMMIT;
