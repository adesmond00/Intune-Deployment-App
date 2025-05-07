import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

// DELETE to permanently delete an app
export async function DELETE(request: Request, { params }: { params: { appId: string } }) {
  try {
    const appId = params.appId
    const supabase = createServerSupabaseClient()

    // First get the app's UUID from the app_id
    const { data: app, error: appError } = await supabase.from("apps").select("id").eq("app_id", appId).single()

    if (appError || !app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 })
    }

    // Hard delete the app
    const { error: deleteError } = await supabase.from("apps").delete().eq("id", app.id)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error permanently deleting app:", error)
    return NextResponse.json({ error: "Failed to permanently delete app" }, { status: 500 })
  }
}
