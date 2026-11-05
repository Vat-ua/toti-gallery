BEGIN;

ALTER TABLE gallery_users ADD COLUMN slug text;
ALTER TABLE gallery_users ADD COLUMN primary_turma_id text
  REFERENCES gallery_turmas(id) ON DELETE SET NULL;

-- Assign each existing profile a readable, unique address without changing IDs,
-- credentials, timestamps, membership, authorship or any existing column.
DO $$
DECLARE person record; base text; candidate text; suffix integer;
BEGIN
  FOR person IN SELECT id, name FROM gallery_users ORDER BY created_at, id LOOP
    base := trim(both '-' FROM regexp_replace(
      regexp_replace(normalize(lower(person.name), NFD), U&'[\0300-\036f]', '', 'g'),
      '[^a-z0-9]+', '-', 'g'));
    base := coalesce(nullif(rtrim(left(base, 80), '-'), ''), 'pessoa');
    candidate := base; suffix := 1;
    WHILE EXISTS (SELECT 1 FROM gallery_users WHERE slug = candidate) LOOP
      suffix := suffix + 1; candidate := base || '-' || suffix;
    END LOOP;
    UPDATE gallery_users SET slug = candidate WHERE id = person.id;
  END LOOP;
END $$;

-- Application provisioning supplies a name-based slug. This unique fallback
-- also supports direct fixture inserts and fresh Drizzle-created databases.
ALTER TABLE gallery_users ALTER COLUMN slug SET NOT NULL;
ALTER TABLE gallery_users ALTER COLUMN slug SET DEFAULT
  ('pessoa-' || replace(gen_random_uuid()::text, '-', ''));
CREATE UNIQUE INDEX gallery_users_slug_idx ON gallery_users(slug);
ALTER TABLE gallery_users ADD CONSTRAINT gallery_users_slug_check
  CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 120);
CREATE INDEX gallery_users_primary_turma_idx ON gallery_users(primary_turma_id);

COMMIT;
