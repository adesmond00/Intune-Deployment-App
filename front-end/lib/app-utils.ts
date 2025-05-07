/**
 * Generates a unique app ID in the format "APP001", "APP002", etc.
 *
 * @param existingIds - Array of existing app IDs to avoid duplicates
 * @returns A new unique app ID
 */
export function generateAppId(existingIds: string[]): string {
  // Find the highest number in existing IDs
  let highestNum = 0

  existingIds.forEach((id) => {
    if (id.startsWith("APP")) {
      const numPart = id.substring(3)
      const num = Number.parseInt(numPart, 10)
      if (!isNaN(num) && num > highestNum) {
        highestNum = num
      }
    }
  })

  // Generate new ID with incremented number
  const newNum = highestNum + 1
  return `APP${newNum.toString().padStart(3, "0")}`
}

/**
 * Generates a version ID by combining app ID and version
 *
 * @param appId - The app ID
 * @param version - The version string
 * @returns A version ID in the format "APP001-1.0.0"
 */
export function generateVersionId(appId: string, version: string): string {
  return `${appId}-${version}`
}
