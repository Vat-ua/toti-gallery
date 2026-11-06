# Backup and restore

A manual recovery procedure for the prototype. Any production restore still
requires explicit approval under [Environments](environments.md).

## Verified on 2026-11-05

- Read-only project inspection: PostgreSQL **18**, N. Virginia,
  `history_retention_seconds = 21600` (**6 hours**). The available historical
  range can be shorter; this is not an indefinite backup.
- Development `gallery-images`: authenticated Head/List works, three objects,
  no enabled versioning. Production storage credentials were unavailable;
  its configuration was not changed or independently verified.
- A PostgreSQL point-in-time restore **does not restore Object Storage**.
  Forking inherits current objects, but is not historical image recovery.
  Neon does not enforce S3 versioning/lifecycle rules; do not rely on them.
- No scheduled independent backups exist. Migration JSON snapshots are not
  self-contained PostgreSQL backups. The São Paulo project is a historical
  migration fallback, not a current backup.

Sources: [History window](https://neon.com/docs/postgres/backup-restore/history-window),
[Restore scope](https://neon.com/docs/postgres/backup-restore/branch-restore),
[Storage limitations](https://neon.com/docs/storage/s3-compatibility).

## Make a matching backup

1. Coordinate a brief interval without edits, uploads or deletions. Record the
   UTC time, Git commit and verified branch/database. Select its **direct**
   PostgreSQL connection and matching storage credentials. Keep credentials in
   private PostgreSQL service/AWS profile files, never shell history or Git;
   retain the matching Better Auth secret separately in secure configuration.
2. With PostgreSQL 18 tools and a privately configured `gallery-backup` service:

   ```sh
   umask 077
   mkdir -p tmp/backups/DATE/images
   PGSERVICE=gallery-backup PGOPTIONS='-c default_transaction_read_only=on' \
     pg_dump --format=custom --no-owner --no-acl \
     --file=tmp/backups/DATE/database.dump
   pg_restore --list tmp/backups/DATE/database.dump > tmp/backups/DATE/contents.txt
   ```

3. Copy **all** bucket files, retaining exact keys: avatars, covers and thumbnails.
   Use ListObjectsV2/GetObject from the existing SDK, or a path-style AWS CLI profile:

   ```sh
   aws --profile gallery-backup --endpoint-url "$GALLERY_BACKUP_S3_ENDPOINT" \
     s3 cp s3://gallery-images/ tmp/backups/DATE/images/ --recursive
   ```

4. Save file counts/sizes/SHA-256 digests, verify downloads and the managed keys
   referenced in DB metadata. Move the complete pair to separate private storage,
   then resume writes. Use a new dated directory each time. An ignored laptop
   folder is not an independent backup; archives contain personal/auth data and
   must never enter Git or GitHub test artifacts.

## Restore into isolation first

1. Preserve the current state and coordinate writes. For a recent DB-only mistake,
   inspect the historical state with Neon Time Travel / an isolated recovery copy
   before approving a restore. Branch restoration affects **every PostgreSQL DB**
   on that branch, excludes later writes and leaves Object Storage unchanged.
2. For an archive, verify an **empty isolated recovery database**, then restore:

   ```sh
   pg_restore --dbname='service=gallery-restore' --exit-on-error \
     --single-transaction --no-owner --no-acl tmp/backups/DATE/database.dump
   ```

3. Copy matching images into the recovery bucket under their original keys, using
   recovery credentials. Verify checksums, full images and thumbnails. Do not
   synchronize deletions into another bucket. DB recovery cannot recreate a lost file.
4. Run an isolated local app against that pair. Check IDs/counts, memberships,
   authorship, likes, project visibility, login and representative images. The
   code/schema and auth secret must match. Invalidate copied sessions before
   sharing a recovery copy with another developer.
5. After review and explicit approval, choose selective data recovery or switching
   the live connection. Retain the previous target. A Vercel code rollback does
   not reverse database/storage writes.

No production restore/migration, image restore or full archive restore drill was
performed here. PostgreSQL/AWS CLI tools were absent from this machine's PATH;
these commands document the procedure, not a completed dump/restore rehearsal.
References: [pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html),
[pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html).
