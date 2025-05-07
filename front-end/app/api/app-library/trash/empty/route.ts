import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

// DELETE to empty the trash (permanently delete all soft-deleted items)
export async function DELETE() {
  try {
    const supabase = createServerSupabaseClient()

    // Hard delete all soft-deleted apps
    const { error: deleteAppsError } = await supabase.from("apps").delete().not("deleted_at", "is", null)

    if (deleteAppsError) throw deleteAppsError

    // Hard delete all soft-deleted versions
    const { error: deleteVersionsError } = await supabase.from("app_versions").delete().not("deleted_at", "is", null)

    if (deleteVersionsError) throw deleteVersionsError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error emptying trash:", error)
    return NextResponse.json({ error: "Failed to empty trash" }, { status: 500 })
  }
}
