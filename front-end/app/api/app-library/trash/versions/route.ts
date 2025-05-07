import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

// GET recently deleted versions
export async function GET() {
  try {
    const supabase = createServerSupabaseClient()

    const { data, error } = await supabase
      .from("app_versions")
      .select("*, apps(name, app_id)")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })

    if (error) throw error

    // Transform the data to a more usable format
    const transformedData = data.map((version) => ({
      ...version,
      app_name: version.apps.name,
      app_id_code: version.apps.app_id,
    }))

    return NextResponse.json(transformedData)
  } catch (error) {
    console.error("Error fetching deleted versions:", error)
    return NextResponse.json({ error: "Failed to fetch deleted versions" }, { status: 500 })
  }
}
