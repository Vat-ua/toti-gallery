-- Stage 1 target schema; do not apply to the current legacy application.
-- Coordinate application cutover first. See platform-foundation.md.
BEGIN;

-- Fail rather than merge identities or guess at missing memberships.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM gallery_users WHERE cohort IS NULL OR btrim(cohort) = '') THEN
    RAISE EXCEPTION 'Every legacy user needs a turma before this migration';
  END IF;
  IF EXISTS (SELECT 1 FROM gallery_users GROUP BY lower(btrim(email)) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Resolve case/whitespace-equivalent emails before migrating; accounts will not be merged';
  END IF;
  IF EXISTS (SELECT 1 FROM gallery_users GROUP BY lower(btrim(cohort)) HAVING count(DISTINCT cohort) > 1) THEN
    RAISE EXCEPTION 'Resolve case/whitespace-equivalent turma names before migrating';
  END IF;
END $$;

-- Deliberately not IF NOT EXISTS: accidental reapplication rolls back rather
-- than restoring memberships or overriding later administrator decisions.
CREATE TABLE gallery_turmas (
  id text PRIMARY KEY,
  name text NOT NULL,
  graduation_year integer,
  archived_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT gallery_turmas_name_check CHECK (length(btrim(name)) > 0)
);
CREATE UNIQUE INDEX gallery_turmas_name_normalized_idx ON gallery_turmas (lower(btrim(name)));

ALTER TABLE gallery_users
  ADD COLUMN email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN role text NOT NULL DEFAULT 'user',
  ADD COLUMN status text,
  ADD COLUMN updated_at timestamp,
  ALTER COLUMN password_hash DROP NOT NULL,
  ALTER COLUMN cohort DROP NOT NULL,
  ALTER COLUMN year DROP NOT NULL,
  ALTER COLUMN bio SET DEFAULT '';
-- Preserve existing access without falsely claiming that emails were verified.
UPDATE gallery_users SET status = 'active', updated_at = created_at;
ALTER TABLE gallery_users
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL,
  ADD CONSTRAINT gallery_users_role_check CHECK (role IN ('user', 'admin')),
  ADD CONSTRAINT gallery_users_status_check CHECK (status IN ('pending', 'active', 'suspended'));
CREATE UNIQUE INDEX gallery_users_email_normalized_idx ON gallery_users (lower(btrim(email)));

-- A turma is identified by its existing label, not each student's chosen year.
-- Conflicting legacy years stay on users; leave the turma year unresolved.
INSERT INTO gallery_turmas (id, name, graduation_year, created_at)
SELECT 'legacy-turma-' || md5(cohort), cohort,
  CASE WHEN count(DISTINCT year) = 1 THEN min(year) ELSE NULL END,
  min(created_at)
FROM gallery_users GROUP BY cohort;
-- Preserve the existing selector's empty groups as well as populated ones.
INSERT INTO gallery_turmas (id, name)
SELECT 'legacy-turma-' || md5(name), name
FROM (VALUES ('Turma 25'), ('Turma 24'), ('Turma 23'), ('Turma 22'), ('Turma 21')) configured(name)
WHERE NOT EXISTS (SELECT 1 FROM gallery_turmas t WHERE t.name = configured.name);

CREATE TABLE gallery_turma_members (
  turma_id text NOT NULL REFERENCES gallery_turmas(id) ON DELETE RESTRICT,
  user_id text NOT NULL REFERENCES gallery_users(id) ON DELETE RESTRICT,
  joined_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT gallery_turma_members_turma_id_user_id_pk PRIMARY KEY (turma_id, user_id)
);
CREATE INDEX gallery_turma_members_user_id_idx ON gallery_turma_members(user_id);
INSERT INTO gallery_turma_members (turma_id, user_id, joined_at)
SELECT t.id, u.id, u.created_at FROM gallery_users u JOIN gallery_turmas t ON t.name = u.cohort;

CREATE TABLE gallery_auth_accounts (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES gallery_users(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamp,
  refresh_token_expires_at timestamp,
  scope text,
  password text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT gallery_auth_accounts_credential_identity_check CHECK (provider_id <> 'credential' OR account_id = user_id)
);
CREATE UNIQUE INDEX gallery_auth_accounts_provider_identity_idx ON gallery_auth_accounts(provider_id, account_id);
CREATE INDEX gallery_auth_accounts_user_id_idx ON gallery_auth_accounts(user_id);

-- Empty until stage 2: copying hashes now would become stale if a legacy user
-- changed their password before the auth cutover. Preserve password_hash as-is.
CREATE TABLE gallery_auth_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES gallery_users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamp NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX gallery_auth_sessions_user_id_idx ON gallery_auth_sessions(user_id);
CREATE TABLE gallery_auth_verifications (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX gallery_auth_verifications_identifier_idx ON gallery_auth_verifications(identifier);

CREATE TABLE gallery_invitations (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES gallery_users(id) ON DELETE RESTRICT,
  created_by text NOT NULL REFERENCES gallery_users(id) ON DELETE RESTRICT,
  purpose text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamp NOT NULL,
  consumed_at timestamp,
  revoked_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT gallery_invitations_purpose_check CHECK (purpose IN ('activation', 'password_reset')),
  CONSTRAINT gallery_invitations_token_hash_check CHECK (length(token_hash) = 64 AND token_hash !~ '[^0-9a-f]'),
  CONSTRAINT gallery_invitations_expiry_check CHECK (expires_at > created_at),
  CONSTRAINT gallery_invitations_lifecycle_check CHECK (consumed_at IS NULL OR revoked_at IS NULL)
);
CREATE INDEX gallery_invitations_user_id_idx ON gallery_invitations(user_id);

ALTER TABLE gallery_projects
  ADD COLUMN turma_id text REFERENCES gallery_turmas(id) ON DELETE RESTRICT,
  ADD COLUMN visibility text NOT NULL DEFAULT 'published',
  ADD COLUMN moderation_reason text,
  ADD COLUMN moderated_by text REFERENCES gallery_users(id) ON DELETE RESTRICT,
  ADD COLUMN moderated_at timestamp;
UPDATE gallery_projects p SET turma_id = t.id
FROM gallery_users u JOIN gallery_turmas t ON t.name = u.cohort
WHERE u.id = p.author_id;
ALTER TABLE gallery_projects
  ALTER COLUMN turma_id SET NOT NULL,
  ADD CONSTRAINT gallery_projects_visibility_check CHECK (visibility IN ('published', 'hidden')),
  ADD CONSTRAINT gallery_projects_hidden_reason_check CHECK (
    visibility <> 'hidden' OR (
      length(btrim(coalesce(moderation_reason, ''))) > 0
      AND moderated_by IS NOT NULL AND moderated_at IS NOT NULL
    )
  );
CREATE INDEX gallery_projects_turma_id_idx ON gallery_projects(turma_id);

-- No changes to project authors, likes, owner FKs, legacy hashes or sessions.
COMMIT;
