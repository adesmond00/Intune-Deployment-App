/// <reference types="vite/client" />

/**
 * Configuration file for frontend settings.
 * This file centralizes configuration variables for easy management.
 */

/**
 * The base URL for the backend API.
 * This value is read from the VITE_API_BASE_URL environment variable,
 * which is set by the development startup script (e.g., dev.py)
 * or during the build process for production.
 */
const envApiUrl = import.meta.env.VITE_API_BASE_URL;

if (!envApiUrl) {
  console.error(
    "Fatal Error: VITE_API_BASE_URL environment variable is not set. " +
    "Ensure the development script (dev.py) is running correctly or the environment variable is set during build."
  );
  // Provide a default fallback for critical failure, although connection will likely fail.
  // Or throw an error: throw new Error("VITE_API_BASE_URL is not set");
}

export const API_BASE_URL = envApiUrl || 'http://127.0.0.1:60706'; // Fallback only as last resort

// Set to true to enable debug-specific UI elements and features
export const debugMode = true;

// Add other frontend configuration constants here as needed.

// Other configuration constants can be added here
export const APP_NAME = 'Intune Deployment Toolkit';
export const APP_VERSION = '1.0.0';
