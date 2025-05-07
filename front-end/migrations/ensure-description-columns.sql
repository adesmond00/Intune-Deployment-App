-- Ensure description column exists in apps table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'apps' AND column_name = 'description'
    ) THEN
        ALTER TABLE apps ADD COLUMN description TEXT DEFAULT NULL;
    END IF;
END $$;

-- Ensure description column exists in app_versions table
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
