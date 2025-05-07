import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { softDeleteApp, restoreApp } from "@/lib/soft-delete-utils"

// GET a specific app
export async function GET(request: Request, { params }: { params: { appId: string } }) {
  try {
    const appId = params.appId
    const supabase = createServerSupabaseClient()

    const { data, error } = await supabase.from("apps").select("*").eq("app_id", appId).is("deleted_at", null).single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching app:", error)
    return NextResponse.json({ error: "Failed to fetch app" }, { status: 500 })
  }
}

// PUT to update an app
export async function PUT(request: Request, { params }: { params: { appId: string } }) {
  try {
    const appId = params.appId
    const body = await request.json()
    const supabase = createServerSupabaseClient()

    // Validate required fields
    if (!body.name || !body.publisher) {
      return NextResponse.json({ error: "Name and publisher are required" }, { status: 400 })
    }

    // Get the app's UUID from the app_id
    const { data: app, error: appError } = await supabase.from("apps").select("id").eq("app_id", appId).single()

    if (appError || !app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 })
    }

    // Update the app
    const { data, error } = await supabase
      .from("apps")
      .update({
        name: body.name,
        publisher: body.publisher,
        description: body.description,
        category: body.category,
        updated_at: new Date().toISOString(),
      })
      .eq("id", app.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error updating app:", error)
    return NextResponse.json({ error: "Failed to update app" }, { status: 500 })
  }
}

// DELETE (soft delete) an app
export async function DELETE(request: Request, { params }: { params: { appId: string } }) {
  try {
    const appId = params.appId
    await softDeleteApp(appId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting app:", error)
    return NextResponse.json({ error: "Failed to delete app" }, { status: 500 })
  }
}

// PATCH to restore a deleted app
export async function PATCH(request: Request, { params }: { params: { appId: string } }) {
  try {
    const appId = params.appId
    await restoreApp(appId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error restoring app:", error)
    return NextResponse.json({ error: "Failed to restore app" }, { status: 500 })
  }
}
