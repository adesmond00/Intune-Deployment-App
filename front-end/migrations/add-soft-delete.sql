-- Add deleted_at column to apps table
ALTER TABLE apps ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_at column to app_versions table
ALTER TABLE app_versions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create a view for recently deleted apps
CREATE OR REPLACE VIEW recently_deleted_apps AS
SELECT * FROM apps
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC
LIMIT 50;

-- Create a view for recently deleted versions
CREATE OR REPLACE VIEW recently_deleted_versions AS
SELECT v.*, a.name as app_name, a.app_id as app_id_code
FROM app_versions v
JOIN apps a ON v.app_id = a.id
WHERE v.deleted_at IS NOT NULL AND a.deleted_at IS NULL
ORDER BY v.deleted_at DESC
LIMIT 50;
