-- Check if deleted_at column exists in apps table
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_name = 'apps'
  AND column_name = 'deleted_at'
) as apps_has_deleted_at;

-- Check if deleted_at column exists in app_versions table
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_name = 'app_versions'
  AND column_name = 'deleted_at'
) as app_versions_has_deleted_at;
