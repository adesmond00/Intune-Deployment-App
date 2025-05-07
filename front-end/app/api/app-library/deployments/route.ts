import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

// POST a new deployment
export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()

    // Validate required fields
    if (!body.appVersionId || !body.status) {
      return NextResponse.json({ error: "App version ID and status are required" }, { status: 400 })
    }

    // Insert the new deployment
    const { data, error } = await supabase
      .from("deployments")
      .insert({
        app_version_id: body.appVersionId,
        status: body.status,
        intune_app_id: body.intuneAppId || null,
        error_message: body.errorMessage || null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Error creating deployment:", error)
    return NextResponse.json({ error: "Failed to create deployment" }, { status: 500 })
  }
}
