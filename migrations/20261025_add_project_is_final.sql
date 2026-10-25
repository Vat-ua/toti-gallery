-- Apply to existing databases; fresh databases use the current Drizzle schema.
-- Existing projects remain unmarked until their authors choose otherwise.
ALTER TABLE "gallery_projects"
  ADD COLUMN IF NOT EXISTS "is_final" boolean NOT NULL DEFAULT false;
