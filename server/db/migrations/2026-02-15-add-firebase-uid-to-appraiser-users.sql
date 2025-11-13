-- Add firebase_uid for appraiser auth sync while keeping backward compatibility.
-- Existing users without firebase_uid remain valid and can be linked by email on first login.

SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'appraiser_users'
    AND column_name = 'firebase_uid'
);

SET @col_sql := IF(
  @col_exists = 0,
  'ALTER TABLE appraiser_users ADD COLUMN firebase_uid VARCHAR(128) NULL',
  'SELECT 1'
);

PREPARE col_stmt FROM @col_sql;
EXECUTE col_stmt;
DEALLOCATE PREPARE col_stmt;

SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'appraiser_users'
    AND index_name = 'uq_appraiser_user_firebase_uid'
);

SET @idx_sql := IF(
  @idx_exists = 0,
  'ALTER TABLE appraiser_users ADD UNIQUE KEY uq_appraiser_user_firebase_uid (firebase_uid)',
  'SELECT 1'
);

PREPARE idx_stmt FROM @idx_sql;
EXECUTE idx_stmt;
DEALLOCATE PREPARE idx_stmt;
