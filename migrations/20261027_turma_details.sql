BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM gallery_turmas WHERE name !~ '^Turma [1-9][0-9]{0,8}$') THEN
    RAISE EXCEPTION 'Review existing turma labels before assigning unique numbers';
  END IF;
END $$;
ALTER TABLE gallery_turmas ADD COLUMN number integer;
ALTER TABLE gallery_turmas ADD COLUMN course_name text;
ALTER TABLE gallery_turmas ADD COLUMN start_year integer;
UPDATE gallery_turmas SET number = substring(name from '[0-9]+$')::integer;
ALTER TABLE gallery_turmas ALTER COLUMN number SET NOT NULL;
CREATE UNIQUE INDEX gallery_turmas_number_idx ON gallery_turmas(number);
ALTER TABLE gallery_turmas ADD CONSTRAINT gallery_turmas_number_check CHECK (number > 0);
ALTER TABLE gallery_turmas ADD CONSTRAINT gallery_turmas_start_year_check CHECK (start_year IS NULL OR start_year BETWEEN 2000 AND 2100);
ALTER TABLE gallery_turmas ADD CONSTRAINT gallery_turmas_course_name_check CHECK (course_name IS NULL OR length(btrim(course_name)) BETWEEN 2 AND 100);
-- Course and start year are deliberately unknown for historical groups.
COMMIT;
