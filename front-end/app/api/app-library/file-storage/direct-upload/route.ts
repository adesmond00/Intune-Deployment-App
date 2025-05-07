import { NextResponse } from "next/server"
import { backblazeConfig } from "@/lib/backblaze-config"

// This endpoint handles file uploads to BackBlaze using direct HTTP requests
// This is a fallback in case the AWS SDK approach doesn't work in your environment
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const path = formData.get("path") as string

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!path) {
      return NextResponse.json({ error: "No path provided" }, { status: 400 })
    }

    // Convert file to buffer
    const buffer = await file.arrayBuffer()

    // Get authorization token
    const authString = `${backblazeConfig.applicationKeyId}:${backblazeConfig.applicationKey}`
    const authToken = Buffer.from(authString).toString("base64")

    // Upload to BackBlaze B2 using fetch
    const uploadUrl = `${backblazeConfig.endpoint}/${backblazeConfig.bucketName}/${path}`

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Basic ${authToken}`,
        "Content-Type": file.type,
        "X-Bz-File-Name": path,
        "X-Bz-Content-Sha1": "do_not_verify", // In a production app, you'd compute the SHA1
      },
      body: buffer,
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
    }

    // Return the path
    return NextResponse.json({ path })
  } catch (error) {
    console.error("Error uploading file:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload file" },
      { status: 500 },
    )
  }
}
