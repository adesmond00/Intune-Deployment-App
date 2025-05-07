import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { softDeleteVersion, restoreVersion } from "@/lib/soft-delete-utils"
import { deleteFileFromBackBlaze } from "@/lib/backblaze-utils"

// GET a specific version
export async function GET(request: Request, { params }: { params: { versionId: string } }) {
  try {
    const versionId = params.versionId
    const supabase = createServerSupabaseClient()

    const { data, error } = await supabase
      .from("app_versions")
      .select("*")
      .eq("version_id", versionId)
      .is("deleted_at", null)
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching version:", error)
    return NextResponse.json({ error: "Failed to fetch version" }, { status: 500 })
  }
}

// PUT to update a version
export async function PUT(request: Request, { params }: { params: { versionId: string } }) {
  try {
    const versionId = params.versionId
    const body = await request.json()
    const supabase = createServerSupabaseClient()

    // Validate required fields
    if (!body.version) {
      return NextResponse.json({ error: "Version number is required" }, { status: 400 })
    }

    // Get the version's UUID from the version_id
    const { data: version, error: versionError } = await supabase
      .from("app_versions")
      .select("id, app_id, is_current, path")
      .eq("version_id", versionId)
      .single()

    if (versionError || !version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 })
    }

    // If there's a new file path and there was an old one, delete the old file
    if (body.path && version.path && body.path !== version.path) {
      try {
        await deleteFileFromBackBlaze(version.path)
      } catch (deleteError) {
        console.error("Error deleting old file:", deleteError)
        // Continue with the update even if file deletion fails
      }
    }

    // First update the version without changing is_current
    const updateData = {
      version: body.version,
      description: body.description,
      release_notes: body.releaseNotes,
      detection_script: body.detectionScript,
      install_command: body.installCommand,
      uninstall_command: body.uninstallCommand,
      path: body.path || version.path,
      updated_at: new Date().toISOString(),
      // Don't update is_current yet
    }

    const { data: updatedVersion, error: updateError } = await supabase
      .from("app_versions")
      .update(updateData)
      .eq("id", version.id)
      .select()
      .single()

    if (updateError) throw updateError

    // Handle the current flag separately if it's changing
    if (body.isCurrent !== undefined && body.isCurrent !== version.is_current) {
      try {
        if (body.isCurrent) {
          // If setting this version as current, first unset any other current versions
          const { data: currentVersions } = await supabase
            .from("app_versions")
            .select("id")
            .eq("app_id", version.app_id)
            .eq("is_current", true)
            .neq("id", version.id)
            .is("deleted_at", null)

          // Unset other current versions one by one
          if (currentVersions && currentVersions.length > 0) {
            for (const currentVersion of currentVersions) {
              const { error } = await supabase
                .from("app_versions")
                .update({ is_current: false })
                .eq("id", currentVersion.id)

              if (error) {
                console.error(`Error unsetting current version ${currentVersion.id}:`, error)
                // Continue with other versions even if one fails
              }
            }
          }

          // Now set this version as current
          const { data: finalVersion, error: finalUpdateError } = await supabase
            .from("app_versions")
            .update({ is_current: true })
            .eq("id", version.id)
            .select()
            .single()

          if (finalUpdateError) {
            console.error("Error setting version as current:", finalUpdateError)
            // Return the partially updated version
            return NextResponse.json(updatedVersion)
          }

          return NextResponse.json(finalVersion)
        } else {
          // If unsetting this version as current, just update it
          const { data: finalVersion, error: finalUpdateError } = await supabase
            .from("app_versions")
            .update({ is_current: false })
            .eq("id", version.id)
            .select()
            .single()

          if (finalUpdateError) {
            console.error("Error unsetting version as current:", finalUpdateError)
            // Return the partially updated version
            return NextResponse.json(updatedVersion)
          }

          return NextResponse.json(finalVersion)
        }
      } catch (error) {
        console.error("Error handling current version flag:", error)
        // Return the partially updated version
        return NextResponse.json(updatedVersion)
      }
    }

    return NextResponse.json(updatedVersion)
  } catch (error) {
    console.error("Error updating version:", error)
    return NextResponse.json({ error: "Failed to update version" }, { status: 500 })
  }
}

// DELETE (soft delete) a version
export async function DELETE(request: Request, { params }: { params: { versionId: string } }) {
  try {
    const versionId = params.versionId
    await softDeleteVersion(versionId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting version:", error)
    // Return the actual error message with appropriate status code
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete version",
      },
      { status: 400 },
    )
  }
}

// PATCH to restore a deleted version
export async function PATCH(request: Request, { params }: { params: { versionId: string } }) {
  try {
    const versionId = params.versionId
    await restoreVersion(versionId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error restoring version:", error)
    return NextResponse.json({ error: "Failed to restore version" }, { status: 500 })
  }
}
