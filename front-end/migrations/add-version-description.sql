-- Add description column to app_versions table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'app_versions' AND column_name = 'description'
    ) THEN
        ALTER TABLE app_versions ADD COLUMN description TEXT DEFAULT NULL;
    END IF;
END $$;
