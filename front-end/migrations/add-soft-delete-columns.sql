-- Add deleted_at column to apps table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'apps' AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE apps ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    END IF;
END $$;

-- Add deleted_at column to app_versions table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'app_versions' AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE app_versions ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    END IF;
END $$;
