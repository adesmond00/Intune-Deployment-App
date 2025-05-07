import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { generateAppId } from "@/lib/app-utils"

// GET all apps
export async function GET() {
  try {
    const supabase = createServerSupabaseClient()

    const { data, error } = await supabase
      .from("apps")
      .select("*")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching apps:", error)
    return NextResponse.json({ error: "Failed to fetch apps" }, { status: 500 })
  }
}

// POST a new app
export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()

    // Validate required fields
    if (!body.name || !body.publisher) {
      return NextResponse.json({ error: "Name and publisher are required" }, { status: 400 })
    }

    // Get existing app IDs to generate a new unique ID
    const { data: existingApps } = await supabase.from("apps").select("app_id")

    const existingIds = existingApps?.map((app) => app.app_id) || []
    const newAppId = generateAppId(existingIds)

    // Insert the new app
    const { data, error } = await supabase
      .from("apps")
      .insert({
        app_id: newAppId,
        name: body.name,
        publisher: body.publisher,
        description: body.description || null,
        category: body.category || null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Error creating app:", error)
    return NextResponse.json({ error: "Failed to create app" }, { status: 500 })
  }
}
