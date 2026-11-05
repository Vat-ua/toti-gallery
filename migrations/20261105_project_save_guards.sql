BEGIN;

ALTER TABLE gallery_projects ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE gallery_projects ADD CONSTRAINT gallery_projects_version_check CHECK (version > 0);

-- A receipt and its publication commit together. Retain receipts after deletion:
-- replaying an old request must not recreate a deleted publication.
CREATE TABLE gallery_project_creations (
  author_id text NOT NULL REFERENCES gallery_users(id) ON DELETE RESTRICT,
  request_id text NOT NULL,
  fingerprint text NOT NULL CONSTRAINT gallery_project_creations_fingerprint_check CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  project_id text NOT NULL,
  slug text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (author_id, request_id)
);

COMMIT;
