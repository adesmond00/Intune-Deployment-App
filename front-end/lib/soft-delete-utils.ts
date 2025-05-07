import { supabase } from "@/lib/supabase"

/**
 * Soft deletes an app by setting the deleted_at timestamp
 * Also soft deletes all versions of the app
 *
 * @param appId The app_id of the app to delete
 * @returns A promise that resolves when the operation is complete
 */
export async function softDeleteApp(appId: string): Promise<void> {
  // Get the app's UUID from the app_id
  const { data: app, error: appError } = await supabase.from("apps").select("id").eq("app_id", appId).single()

  if (appError || !app) {
    throw new Error("App not found")
  }

  // Get all versions to track file paths
  const { data: versions, error: versionsError } = await supabase
    .from("app_versions")
    .select("id, path")
    .eq("app_id", app.id)
    .is("deleted_at", null)

  if (versionsError) throw versionsError

  // Soft delete the app by setting deleted_at
  const { error: deleteAppError } = await supabase
    .from("apps")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", app.id)

  if (deleteAppError) throw deleteAppError

  // Also soft delete all versions of this app
  const { error: deleteVersionsError } = await supabase
    .from("app_versions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("app_id", app.id)

  if (deleteVersionsError) throw deleteVersionsError
}

/**
 * Soft deletes a version by setting the deleted_at timestamp
 * If the version is the current version, sets another version as current
 *
 * @param versionId The version_id of the version to delete
 * @returns A promise that resolves when the operation is complete
 */
export async function softDeleteVersion(versionId: string): Promise<void> {
  // Check if this is the current version
  const { data: version, error: versionError } = await supabase
    .from("app_versions")
    .select("id, app_id, is_current, path")
    .eq("version_id", versionId)
    .single()

  if (versionError || !version) {
    throw new Error("Version not found")
  }

  // If this is the current version, we need to check if there are other versions
  if (version.is_current) {
    const { data: otherVersions, error: otherVersionsError } = await supabase
      .from("app_versions")
      .select("id")
      .eq("app_id", version.app_id)
      .neq("id", version.id)
      .is("deleted_at", null)

    if (otherVersionsError) throw otherVersionsError

    if (otherVersions.length === 0) {
      throw new Error("Cannot delete the only version of an application. Delete the application instead.")
    }
  }

  // Soft delete the version by setting deleted_at
  const { error: deleteError } = await supabase
    .from("app_versions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", version.id)

  if (deleteError) throw deleteError

  // If this was the current version, set another version as current
  if (version.is_current) {
    // Find the most recent non-deleted version
    const { data: latestVersion, error: latestVersionError } = await supabase
      .from("app_versions")
      .select("id")
      .eq("app_id", version.app_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (latestVersionError) throw latestVersionError

    // Set it as the current version
    const { error: updateError } = await supabase
      .from("app_versions")
      .update({ is_current: true })
      .eq("id", latestVersion.id)

    if (updateError) throw updateError
  }
}

/**
 * Restores a soft-deleted app by clearing the deleted_at timestamp
 * Also restores all versions of the app
 *
 * @param appId The app_id of the app to restore
 * @returns A promise that resolves when the operation is complete
 */
export async function restoreApp(appId: string): Promise<void> {
  // Get the app's UUID from the app_id
  const { data: app, error: appError } = await supabase.from("apps").select("id").eq("app_id", appId).single()

  if (appError || !app) {
    throw new Error("App not found")
  }

  // Restore the app by clearing deleted_at
  const { error: restoreAppError } = await supabase.from("apps").update({ deleted_at: null }).eq("id", app.id)

  if (restoreAppError) throw restoreAppError

  // Also restore all versions of this app
  const { error: restoreVersionsError } = await supabase
    .from("app_versions")
    .update({ deleted_at: null })
    .eq("app_id", app.id)

  if (restoreVersionsError) throw restoreVersionsError
}

/**
 * Restores a soft-deleted version by clearing the deleted_at timestamp
 *
 * @param versionId The version_id of the version to restore
 * @returns A promise that resolves when the operation is complete
 */
export async function restoreVersion(versionId: string): Promise<void> {
  // Find the version
  const { data: version, error: versionError } = await supabase
    .from("app_versions")
    .select("id, app_id")
    .eq("version_id", versionId)
    .single()

  if (versionError || !version) {
    throw new Error("Version not found")
  }

  // Restore the version by clearing deleted_at
  const { error: restoreError } = await supabase.from("app_versions").update({ deleted_at: null }).eq("id", version.id)

  if (restoreError) throw restoreError
}
