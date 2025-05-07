import { NextResponse } from "next/server"
import { getSignedDownloadUrl } from "@/lib/direct-backblaze"

// This endpoint generates signed URLs for files in BackBlaze
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const path = searchParams.get("path")

    if (!path) {
      return NextResponse.json({ error: "No path provided" }, { status: 400 })
    }

    // Generate a signed URL
    const url = await getSignedDownloadUrl(path)

    return NextResponse.json({ url })
  } catch (error) {
    console.error("Error generating signed URL:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate signed URL" },
      { status: 500 },
    )
  }
}
