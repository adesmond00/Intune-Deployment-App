/**
 * API configuration for the Intune Deployment App
 */

// Get the API base URL from environment variables or use a default
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"

// Export other API-related constants
export const API_ENDPOINTS = {
  APPS: `${API_BASE_URL}/apps`,
  APP_LIBRARY_DEPLOY: `${API_BASE_URL}/app-library/deploy`,
  SEARCH: `${API_BASE_URL}/search`,
  DETECTION_SCRIPT: `${API_BASE_URL}/detection-script`,
}
