# Active Context: Intune Deployment Toolkit

## Current Focus
Implemented PKCE (Proof Key for Code Exchange) in the OAuth 2.0 flow to address Azure AD security requirements (`AADSTS9002325` error).

## Recent Activity
*   **Refined OAuth 2.0 Authentication & Session Management:**
    *   **Flow:** Implemented a standard OAuth 2.0 Authorization Code Grant flow with PKCE.
        1.  **Frontend (`authService.login`) -> Backend (`/auth/login`):** Initiates login.
        2.  **Backend:** Generates state & PKCE verifier/challenge, stores verifier in temporary signed cookie (`STATE_COOKIE_NAME`), redirects user to Microsoft login with state, challenge, client ID, scopes, redirect URI (`/auth/callback`).
        3.  **Microsoft -> Backend (`/auth/callback`):** User authenticates, Microsoft redirects back with authorization code and state.
        4.  **Backend:** Validates state against cookie, exchanges code + PKCE verifier + client secret for access & refresh tokens with Microsoft token endpoint. Clears state cookie.
        5.  **Backend:** Creates secure, signed, HTTP-only session cookie (`SESSION_COOKIE_NAME`) containing refresh token, access token, expiry, and tenant ID. Redirects user back to frontend (`/auth/callback`).
        6.  **Frontend (`AuthCallbackPage`/`TenantContext`) -> Backend (`/intune/status`):** Frontend detects return, calls backend status endpoint. Browser automatically sends `SESSION_COOKIE_NAME`.
        7.  **Backend (`get_current_session` dependency):** Validates session cookie. If access token is expired, uses refresh token (from cookie) to get new tokens from Microsoft, updates session cookie. Returns status (`{ "active": true, ... }`).
    *   **Script Execution (`/execute-script`):**
        1.  Frontend calls endpoint with script details. Browser sends `SESSION_COOKIE_NAME`.
        2.  Backend uses `get_current_session` to validate session and get/refresh access token.
        3.  Backend launches a *temporary* PowerShell process for the request.
        4.  Backend passes the valid access token to the script via `-AccessToken` parameter.
        5.  PowerShell script uses `Connect-MgGraph -AccessToken $AccessToken`.
        6.  Script executes, returns result to backend, backend returns to frontend.
        7.  Temporary PowerShell process terminates.
    *   **Key Components:** `api/api.py` (auth endpoints, `get_current_session`), `Front-end/src/services/authService.ts`, `Front-end/src/pages/AuthCallbackPage.tsx`, `Front-end/src/TenantContext.tsx`, `scripts/Add-App-to-Intune.ps1` (accepts `-AccessToken`).
    *   **Security:** Uses PKCE, signed HTTP-only cookies for session management. Deprecated persistent PowerShell sessions.
*   **(Previous)** Resolved Import Errors & Build Issues.
*   **(Previous)** Adjusted Command Line Display & Fixed Modals/Dark Mode.

## Next Steps (Project Development)
*   **Fix Frontend State Update:** Diagnose and fix why the frontend UI (`TenantContext`) doesn't update automatically after successful OAuth login/redirect. The `checkStatus` call on load might not be detecting the new session cookie immediately, or there might be timing issues with the redirect and subsequent API call.
*   **Replace Placeholders:** User MUST replace `YOUR_CLIENT_ID_HERE`, `YOUR_TENANT_ID_HERE`, `YOUR_CLIENT_SECRET_HERE`, and `YOUR_SECRET_KEY_HERE_REPLACE_ME` in `api/api.py` and `Front-end/src/config.ts` for the application to function.
*   **Testing:** Thoroughly test the complete login/logout flow and script execution using the token obtained via the session cookie *after* fixing the UI update issue. Test token refresh scenarios.
*   **Update Other Scripts:** Review other PowerShell scripts (`Package-MSI.ps1`, `Winget-InstallPackage.ps1`) to ensure they accept and use the `-AccessToken` parameter if they need to interact with Intune/Graph API.
*   **Frontend Status/Error Handling:** Improve frontend feedback for OAuth errors (e.g., errors passed in URL params from Microsoft or the backend callback) and token refresh failures.
*   **Deployment Logic:** Implement the core application deployment orchestration logic (packaging, Intune object creation).
*   **Refine UI:** Continue UI refinements based on implemented functionality.
*   **Security Hardening:** Use environment variables for all secrets, restrict CORS policies for production, ensure robust input validation on `/execute-script`.
