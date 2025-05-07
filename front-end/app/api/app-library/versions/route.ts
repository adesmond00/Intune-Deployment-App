import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { generateVersionId } from "@/lib/app-utils"

// GET versions for a specific app
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const appId = searchParams.get("appId")

    if (!appId) {
      return NextResponse.json({ error: "App ID is required" }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    // First get the app's UUID from the app_id
    const { data: app, error: appError } = await supabase.from("apps").select("id").eq("app_id", appId).single()

    if (appError || !app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 })
    }

    // Then get all versions for this app
    const { data: versions, error: versionsError } = await supabase
      .from("app_versions")
      .select("*")
      .eq("app_id", app.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    if (versionsError) throw versionsError

    return NextResponse.json(versions)
  } catch (error) {
    console.error("Error fetching versions:", error)
    return NextResponse.json({ error: "Failed to fetch versions" }, { status: 500 })
  }
}

// POST a new version
export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await request.json()

    // Validate required fields
    if (!body.appId || !body.version) {
      return NextResponse.json({ error: "App ID and version are required" }, { status: 400 })
    }

    // Get the app's UUID from the app_id
    const { data: app, error: appError } = await supabase
      .from("apps")
      .select("id, app_id")
      .eq("app_id", body.appId)
      .single()

    if (appError || !app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 })
    }

    const versionId = generateVersionId(app.app_id, body.version)

    // Check if this version already exists
    const { data: existingVersion } = await supabase
      .from("app_versions")
      .select("id")
      .eq("version_id", versionId)
      .is("deleted_at", null)
      .single()

    if (existingVersion) {
      return NextResponse.json({ error: "This version already exists" }, { status: 409 })
    }

    // Create the insert data object
    const insertData = {
      app_id: app.id,
      version: body.version,
      version_id: versionId,
      release_notes: body.releaseNotes || null,
      detection_script: body.detectionScript || null,
      install_command: body.installCommand || null,
      uninstall_command: body.uninstallCommand || null,
      path: body.path || null,
      is_current: false, // Always set to false initially
      description: body.description || null,
    }

    // Insert the new version with is_current = false
    const { data: newVersion, error: insertError } = await supabase
      .from("app_versions")
      .insert(insertData)
      .select()
      .single()

    if (insertError) {
      console.error("Error inserting new version:", insertError)
      throw insertError
    }

    // If this version should be current, update it in a separate operation
    if (body.isCurrent) {
      try {
        // First, get all current versions for this app
        const { data: currentVersions } = await supabase
          .from("app_versions")
          .select("id")
          .eq("app_id", app.id)
          .eq("is_current", true)
          .is("deleted_at", null)

        // If there are current versions, unset them one by one
        if (currentVersions && currentVersions.length > 0) {
          for (const version of currentVersions) {
            const { error } = await supabase.from("app_versions").update({ is_current: false }).eq("id", version.id)

            if (error) {
              console.error(`Error unsetting current version ${version.id}:`, error)
              // Continue with other versions even if one fails
            }
          }
        }

        // Now set the new version as current
        const { data: updatedVersion, error: updateError } = await supabase
          .from("app_versions")
          .update({ is_current: true })
          .eq("id", newVersion.id)
          .select()
          .single()

        if (updateError) {
          console.error("Error setting new version as current:", updateError)
          // Return the original version even if setting as current fails
          return NextResponse.json(newVersion, { status: 201 })
        }

        return NextResponse.json(updatedVersion, { status: 201 })
      } catch (error) {
        console.error("Error handling current version flag:", error)
        // Return the original version even if setting as current fails
        return NextResponse.json(newVersion, { status: 201 })
      }
    }

    return NextResponse.json(newVersion, { status: 201 })
  } catch (error) {
    console.error("Error creating version:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create version",
      },
      { status: 500 },
    )
  }
}
