-- All existing users were confirmed by the owner to be demonstration records.
-- Preserve their profiles/publications/credits/likes, permanently disable demo
-- authentication, and discard the obsolete hashes and sessions. No real
-- credentials are migrated. Apply once, after stage 1, to the intended DB only.
BEGIN;

ALTER TABLE gallery_users ADD COLUMN is_demo boolean;
UPDATE gallery_users SET is_demo = true;
ALTER TABLE gallery_users
  ALTER COLUMN is_demo SET DEFAULT false,
  ALTER COLUMN is_demo SET NOT NULL,
  DROP COLUMN password_hash;
DROP TABLE gallery_sessions;

CREATE TABLE gallery_auth_rate_limits (
  id text PRIMARY KEY,
  key text NOT NULL UNIQUE,
  count integer NOT NULL,
  last_request bigint NOT NULL
);

COMMIT;
