-- Create a stored procedure to handle updating a version with proper current flag handling
CREATE OR REPLACE FUNCTION update_version_with_current_flag(
  version_id_param UUID,
  app_id_param UUID,
  version_param TEXT,
  description_param TEXT,
  release_notes_param TEXT,
  detection_script_param TEXT,
  is_current_param BOOLEAN,
  path_param TEXT,
  current_is_current_param BOOLEAN
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Start transaction
  BEGIN
    -- If this version will be current and it wasn't before, unset any existing current versions
    IF is_current_param AND NOT current_is_current_param THEN
      UPDATE app_versions
      SET is_current = FALSE
      WHERE app_id = app_id_param AND is_current = TRUE AND id != version_id_param;
    END IF;

    -- Update the version
    UPDATE app_versions
    SET 
      version = version_param,
      description = description_param,
      release_notes = release_notes_param,
      detection_script = detection_script_param,
      is_current = is_current_param,
      path = path_param,
      updated_at = NOW()
    WHERE id = version_id_param;

    -- Get the full record to return
    SELECT row_to_json(v)::JSONB INTO result
    FROM (SELECT * FROM app_versions WHERE id = version_id_param) v;

    -- Commit transaction
    RETURN result;
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback transaction on error
      RAISE;
  END;
END;
$$ LANGUAGE plpgsql;
