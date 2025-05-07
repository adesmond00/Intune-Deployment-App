// BackBlaze B2 configuration
// This file centralizes BackBlaze connection settings for easier configuration

// Default connection settings from environment variables
export const backblazeConfig = {
  // BackBlaze B2 credentials
  bucketId: process.env.BACKBLAZE_BUCKET_ID || "",
  bucketName: process.env.BACKBLAZE_BUCKET_NAME || "",
  applicationKeyId: process.env.BACKBLAZE_APPLICATION_KEY_ID || "",
  applicationKey: process.env.BACKBLAZE_APPLICATION_KEY || "",

  // BackBlaze endpoint
  endpoint: process.env.BACKBLAZE_ENDPOINT || "https://s3.us-west-000.backblazeb2.com",

  // URL expiration time in seconds (default: 1 hour)
  urlExpirationSeconds: 3600,
}
