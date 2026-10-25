BEGIN;

CREATE TABLE IF NOT EXISTS "gallery_project_authors" (
  "project_id" text NOT NULL REFERENCES "gallery_projects"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "gallery_users"("id") ON DELETE CASCADE,
  CONSTRAINT "gallery_project_authors_project_id_user_id_pk" PRIMARY KEY ("project_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "gallery_project_authors_user_id_idx"
  ON "gallery_project_authors" ("user_id");

-- Existing publications keep their owner and gain one authorship link.
INSERT INTO "gallery_project_authors" ("project_id", "user_id")
SELECT "id", "author_id" FROM "gallery_projects"
ON CONFLICT DO NOTHING;

-- Account deletion must not silently erase a publication shared with others.
-- Discover the old FK by its column rather than assuming its constraint name.
DO $$
DECLARE owner_fk record;
BEGIN
  FOR owner_fk IN
    SELECT c.conname FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attname = 'author_id'
    WHERE c.conrelid = 'gallery_projects'::regclass AND c.contype = 'f'
      AND c.conkey = ARRAY[a.attnum]::smallint[]
  LOOP
    EXECUTE format('ALTER TABLE "gallery_projects" DROP CONSTRAINT %I', owner_fk.conname);
  END LOOP;
  ALTER TABLE "gallery_projects"
    ADD CONSTRAINT "gallery_projects_author_id_gallery_users_id_fk"
    FOREIGN KEY ("author_id") REFERENCES "gallery_users"("id") ON DELETE RESTRICT;
END $$;

COMMIT;
