-- For an existing first administrator, set gallery.owner_user_id on this direct
-- connection before applying. No implicit promotion by email or creation order.
BEGIN;
ALTER TABLE gallery_users DROP CONSTRAINT gallery_users_role_check;
ALTER TABLE gallery_users ADD CONSTRAINT gallery_users_role_check CHECK (role IN ('user', 'admin', 'owner'));
CREATE UNIQUE INDEX gallery_users_single_owner_idx ON gallery_users(role) WHERE role = 'owner';
DO $$
DECLARE target_id text := nullif(current_setting('gallery.owner_user_id', true), '');
BEGIN
  IF target_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM gallery_users WHERE id = target_id AND role = 'admin' AND status = 'active' AND NOT is_demo) THEN
      RAISE EXCEPTION 'The explicitly selected owner must be an existing active, non-demo administrator';
    END IF;
    UPDATE gallery_users SET role = 'owner' WHERE id = target_id;
  END IF;
END $$;
COMMIT;
