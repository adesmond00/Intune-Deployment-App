import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

// GET recently deleted apps
export async function GET() {
  try {
    const supabase = createServerSupabaseClient()

    const { data, error } = await supabase
      .from("apps")
      .select("*")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching deleted apps:", error)
    return NextResponse.json({ error: "Failed to fetch deleted apps" }, { status: 500 })
  }
}
