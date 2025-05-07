import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

// DELETE to permanently delete a version
export async function DELETE(request: Request, { params }: { params: { versionId: string } }) {
  try {
    const versionId = params.versionId
    const supabase = createServerSupabaseClient()

    // Find the version
    const { data: version, error: versionError } = await supabase
      .from("app_versions")
      .select("id")
      .eq("version_id", versionId)
      .single()

    if (versionError || !version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 })
    }

    // Hard delete the version
    const { error: deleteError } = await supabase.from("app_versions").delete().eq("id", version.id)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error permanently deleting version:", error)
    return NextResponse.json({ error: "Failed to permanently delete version" }, { status: 500 })
  }
}
