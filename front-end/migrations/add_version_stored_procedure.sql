-- Create a stored procedure to handle adding a version with proper current flag handling
CREATE OR REPLACE FUNCTION add_version_with_current_flag(
  app_id_param UUID,
  version_param TEXT,
  version_id_param TEXT,
  release_notes_param TEXT,
  detection_script_param TEXT,
  path_param TEXT,
  is_current_param BOOLEAN,
  description_param TEXT
) RETURNS JSONB AS $$
DECLARE
  new_version_id UUID;
  result JSONB;
BEGIN
  -- Start transaction
  BEGIN
    -- If this version will be current, unset any existing current versions
    IF is_current_param THEN
      UPDATE app_versions
      SET is_current = FALSE
      WHERE app_id = app_id_param AND is_current = TRUE;
    END IF;

    -- Insert the new version
    INSERT INTO app_versions (
      app_id,
      version,
      version_id,
      release_notes,
      detection_script,
      path,
      is_current,
      description
    ) VALUES (
      app_id_param,
      version_param,
      version_id_param,
      release_notes_param,
      detection_script_param,
      path_param,
      is_current_param,
      description_param
    )
    RETURNING id INTO new_version_id;

    -- Get the full record to return
    SELECT row_to_json(v)::JSONB INTO result
    FROM (SELECT * FROM app_versions WHERE id = new_version_id) v;

    -- Commit transaction
    RETURN result;
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback transaction on error
      RAISE;
  END;
END;
$$ LANGUAGE plpgsql;
