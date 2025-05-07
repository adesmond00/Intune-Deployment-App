/**
 * Direct BackBlaze B2 API implementation without using AWS SDK
 * This avoids any file system dependencies that cause errors in browser/serverless environments
 */
import { backblazeConfig } from "./backblaze-config"

// Cache for the auth token and upload URL
let authCache: {
  authorizationToken?: string
  apiUrl?: string
  downloadUrl?: string
  expiresAt?: number
} = {}

/**
 * Get an authorization token from BackBlaze B2
 */
async function getAuthToken() {
  // Check if we have a valid cached token
  const now = Date.now()
  if (authCache.authorizationToken && authCache.expiresAt && now < authCache.expiresAt) {
    return {
      authorizationToken: authCache.authorizationToken,
      apiUrl: authCache.apiUrl,
      downloadUrl: authCache.downloadUrl,
    }
  }

  // Encode credentials
  const credentials = Buffer.from(`${backblazeConfig.applicationKeyId}:${backblazeConfig.applicationKey}`).toString(
    "base64",
  )

  // Authorize account
  const response = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
    method: "GET",
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Authorization failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  // Cache the token for 23 hours (tokens are valid for 24 hours)
  authCache = {
    authorizationToken: data.authorizationToken,
    apiUrl: data.apiUrl,
    downloadUrl: data.downloadUrl,
    expiresAt: now + 23 * 60 * 60 * 1000,
  }

  return {
    authorizationToken: data.authorizationToken,
    apiUrl: data.apiUrl,
    downloadUrl: data.downloadUrl,
  }
}

/**
 * Get an upload URL for a file
 */
async function getUploadUrl() {
  const { authorizationToken, apiUrl } = await getAuthToken()

  const response = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: "POST",
    headers: {
      Authorization: authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bucketId: backblazeConfig.bucketId,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to get upload URL: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return {
    uploadUrl: data.uploadUrl,
    authorizationToken: data.authorizationToken,
  }
}

/**
 * Upload a file to BackBlaze B2
 */
export async function uploadFile(file: File, path: string): Promise<string> {
  const { uploadUrl, authorizationToken } = await getUploadUrl()

  // Convert file to array buffer
  const buffer = await file.arrayBuffer()

  // Upload the file
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: authorizationToken,
      "Content-Type": file.type,
      "Content-Length": buffer.byteLength.toString(),
      "X-Bz-File-Name": encodeURIComponent(path),
      "X-Bz-Content-Sha1": "do_not_verify", // In production, compute the SHA1
    },
    body: buffer,
  })

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data.fileName
}

/**
 * Delete a file from BackBlaze B2
 */
export async function deleteFile(path: string): Promise<void> {
  const { authorizationToken, apiUrl } = await getAuthToken()

  // First, get the file ID
  const listResponse = await fetch(`${apiUrl}/b2api/v2/b2_list_file_names`, {
    method: "POST",
    headers: {
      Authorization: authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bucketId: backblazeConfig.bucketId,
      prefix: path,
      maxFileCount: 1,
    }),
  })

  if (!listResponse.ok) {
    throw new Error(`Failed to list files: ${listResponse.status} ${listResponse.statusText}`)
  }

  const listData = await listResponse.json()
  if (listData.files.length === 0) {
    // File doesn't exist, nothing to delete
    return
  }

  const fileId = listData.files[0].fileId

  // Delete the file
  const deleteResponse = await fetch(`${apiUrl}/b2api/v2/b2_delete_file_version`, {
    method: "POST",
    headers: {
      Authorization: authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: path,
      fileId: fileId,
    }),
  })

  if (!deleteResponse.ok) {
    throw new Error(`Delete failed: ${deleteResponse.status} ${deleteResponse.statusText}`)
  }
}

/**
 * Generate a signed download URL for a file
 */
export async function getSignedDownloadUrl(path: string): Promise<string> {
  const { authorizationToken, downloadUrl } = await getAuthToken()

  // Calculate expiration time (1 hour from now)
  const expirationTimestamp = Math.floor(Date.now() / 1000) + backblazeConfig.urlExpirationSeconds

  // Construct the download URL with authorization
  const url = new URL(`${downloadUrl}/file/${backblazeConfig.bucketName}/${path}`)
  url.searchParams.append("Authorization", authorizationToken)
  url.searchParams.append("X-Bz-Expires", expirationTimestamp.toString())

  return url.toString()
}
