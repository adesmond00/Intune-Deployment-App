import { createServerSupabaseClient } from "./supabase-server"
import { dbConfig } from "./db-config"
import { deleteFileFromBackBlaze } from "./backblaze-utils"

/**
 * Cleans up items in the trash that are older than the retention period
 * This function should be called by a scheduled job (e.g., cron job)
 */
export async function cleanupTrash() {
  const supabase = createServerSupabaseClient()
  const retentionDays = dbConfig.trashRetentionDays

  // Calculate the cutoff date
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays)
  const cutoffDateString = cutoffDate.toISOString()

  try {
    // First get all versions that will be deleted to clean up their files
    const { data: versionsToDelete, error: versionsError } = await supabase
      .from("app_versions")
      .select("path")
      .lt("deleted_at", cutoffDateString)
      .not("path", "is", null)

    if (versionsError) throw versionsError

    // Delete files from BackBlaze
    for (const version of versionsToDelete || []) {
      if (version.path) {
        try {
          await deleteFileFromBackBlaze(version.path)
        } catch (error) {
          console.error(`Error deleting file ${version.path}:`, error)
          // Continue with deletion even if file cleanup fails
        }
      }
    }

    // Delete apps that have been in the trash longer than the retention period
    const { error: appsError } = await supabase.from("apps").delete().lt("deleted_at", cutoffDateString)

    if (appsError) throw appsError

    // Delete versions that have been in the trash longer than the retention period
    const { error: versionsDeleteError } = await supabase
      .from("app_versions")
      .delete()
      .lt("deleted_at", cutoffDateString)

    if (versionsDeleteError) throw versionsDeleteError

    console.log(`Trash cleanup completed. Items older than ${retentionDays} days have been permanently deleted.`)
    return { success: true }
  } catch (error) {
    console.error("Error cleaning up trash:", error)
    return { success: false, error }
  }
}
