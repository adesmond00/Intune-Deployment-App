import { NextResponse } from "next/server"
import { cleanupTrash } from "@/lib/trash-cleanup"
import { dbConfig } from "@/lib/db-config"

// POST to trigger trash cleanup
export async function POST() {
  try {
    const result = await cleanupTrash()

    if (!result.success) {
      throw new Error("Cleanup failed")
    }

    return NextResponse.json({
      success: true,
      message: `Trash cleanup completed. Items older than ${dbConfig.trashRetentionDays} days have been permanently deleted.`,
    })
  } catch (error) {
    console.error("Error in cleanup endpoint:", error)
    return NextResponse.json({ error: "Failed to clean up trash" }, { status: 500 })
  }
}
