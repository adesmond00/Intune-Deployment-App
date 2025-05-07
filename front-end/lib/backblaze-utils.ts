/**
 * Generates a unique file path for storing an intunewin file in BackBlaze
 *
 * @param appId The app identifier
 * @param version Optional version string
 * @returns A unique path for the file in BackBlaze
 */
export function generateFilePath(appId: string, version?: string): string {
  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(2, 10)

  if (version) {
    return `intunewin/${appId}/${version}/${timestamp}-${randomString}.intunewin`
  }

  return `intunewin/${appId}/${timestamp}-${randomString}.intunewin`
}

/**
 * Extracts the filename from a file path
 *
 * @param filePath The file path
 * @returns The filename
 */
export function getFileNameFromPath(filePath: string): string {
  if (!filePath) return ""

  const parts = filePath.split("/")
  return parts[parts.length - 1]
}

/**
 * Gets a signed URL for a file in BackBlaze
 *
 * @param filePath The path of the file in the bucket
 * @returns A promise that resolves to the signed URL
 */
export async function getSignedUrl(filePath: string): Promise<string> {
  if (!filePath) return ""

  try {
    const response = await fetch(`/api/app-library/file-storage/signed-url?path=${encodeURIComponent(filePath)}`)

    if (!response.ok) {
      throw new Error("Failed to generate signed URL")
    }

    const data = await response.json()
    return data.url
  } catch (error) {
    console.error("Error generating signed URL:", error)
    return ""
  }
}

/**
 * Deletes a file from BackBlaze B2
 *
 * @param filePath The path of the file to delete
 * @returns A promise that resolves when the file is deleted
 */
export async function deleteFileFromBackBlaze(filePath: string): Promise<void> {
  if (!filePath) return

  try {
    const response = await fetch(`/api/app-library/file-storage?path=${encodeURIComponent(filePath)}`, {
      method: "DELETE",
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to delete file from BackBlaze")
    }
  } catch (error) {
    console.error("Error deleting file from BackBlaze:", error)
    throw error
  }
}
