-- Check if the constraint exists
DO $$
DECLARE
    constraint_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'unique_current_version_per_app'
    ) INTO constraint_exists;

    IF constraint_exists THEN
        -- Drop the existing constraint
        EXECUTE 'ALTER TABLE app_versions DROP CONSTRAINT unique_current_version_per_app';
        
        -- Create a new constraint that allows multiple NULL values
        EXECUTE 'ALTER TABLE app_versions ADD CONSTRAINT unique_current_version_per_app 
                 EXCLUDE USING btree (app_id WITH =) 
                 WHERE (is_current = true AND deleted_at IS NULL)';
                 
        RAISE NOTICE 'Constraint updated successfully';
    ELSE
        RAISE NOTICE 'Constraint does not exist';
    END IF;
END $$;
