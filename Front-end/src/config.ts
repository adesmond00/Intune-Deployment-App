// Base URL for the backend API
export const API_BASE_URL = 'http://localhost:8000';

// Debug mode flag (e.g., for showing mock connection toggles)
export const debugMode = true; // Set to false for production builds or when not debugging

// --- Azure AD Configuration (Replace with your actual values) ---
// Application (client) ID for your Azure AD App Registration
export const AZURE_CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
// Directory (tenant) ID for your Azure AD Tenant
export const AZURE_TENANT_ID = 'YOUR_TENANT_ID_HERE';
// ------------------------------------------------------------------

// Ensure placeholders are replaced before production
if (AZURE_CLIENT_ID === 'YOUR_CLIENT_ID_HERE' || AZURE_TENANT_ID === 'YOUR_TENANT_ID_HERE') {
  console.warn(
    'Azure AD configuration placeholders detected in src/config.ts. ' +
    'Replace YOUR_CLIENT_ID_HERE and YOUR_TENANT_ID_HERE with your actual Azure AD App Registration details.'
  );
}
