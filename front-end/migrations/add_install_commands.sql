-- Add install and uninstall command fields to app_versions table
ALTER TABLE app_versions 
ADD COLUMN IF NOT EXISTS install_command TEXT,
ADD COLUMN IF NOT EXISTS uninstall_command TEXT;

-- Add an index to improve query performance
CREATE INDEX IF NOT EXISTS idx_app_versions_app_id ON app_versions(app_id);
