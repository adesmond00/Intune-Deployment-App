# Active Context: Intune Deployment Toolkit

## Current Focus
Resolving authentication issues during Win32 app deployment triggered from the Winget page.

## Recent Activity
*   **Resolved Deployment Authentication Error (401):**
    *   **Diagnosis:** Identified that the `Add-IntuneWin32App` cmdlet (from `IntuneWin32App` module) was likely failing to use the access token provided via `Connect-MgGraph -AccessToken`, resulting in a 401 error during deployment attempts initiated by the backend.
    *   **Solution:** Refactored `scripts/Add-App-to-Intune.ps1` to bypass the `IntuneWin32App` module for deployment. The script now uses direct Microsoft Graph API calls (`Invoke-RestMethod`) with the provided `-AccessToken` to perform the necessary steps (create app object, create content version, create file entry, get SAS URI, upload file, patch app object with rules/details).
    *   **Backend Update:** Modified the `/execute-script` endpoint in `api/api.py` to correctly format parameters for the refactored script, specifically converting detection/requirement rules into JSON strings that PowerShell can parse into the expected custom objects.
    *   **Memory Bank Update:** Updated `systemPatterns.md` and `techContext.md` to reflect the removal of the `IntuneWin32App` dependency for deployment and the adoption of direct Graph API calls.
*   **(Previous)** Implemented PKCE (Proof Key for Code Exchange) in the OAuth 2.0 flow.
*   **(Previous)** Refined OAuth 2.0 Authentication & Session Management (details below).
*   **(Previous)** Resolved Import Errors & Build Issues.
*   **(Previous)** Adjusted Command Line Display & Fixed Modals/Dark Mode.

## Authentication & Session Management Details (Still Active)
*   **Flow:** Standard OAuth 2.0 Authorization Code Grant flow with PKCE.
    1.  Frontend (`authService.login`) -> Backend (`/auth/login`).
    2.  Backend generates state & PKCE, stores verifier in temp cookie, redirects to Microsoft.
    3.  Microsoft -> Backend (`/auth/callback`) with code & state.
    4.  Backend validates state, exchanges code + verifier + secret for tokens.
    5.  Backend creates secure session cookie (`SESSION_COOKIE_NAME`) with tokens, redirects to frontend.
    6.  Frontend (`AuthCallbackPage`/`TenantContext`) -> Backend (`/intune/status`).
    7.  Backend (`get_current_session`) validates session, refreshes token if needed.
*   **Script Execution (`/execute-script`):**
    1.  Frontend calls endpoint. Browser sends session cookie.
    2.  Backend uses `get_current_session` to get valid access token.
    3.  Backend launches temporary PowerShell process.
    4.  Backend passes token via `-AccessToken` and formats other parameters (including rules as JSON strings).
    5.  `Add-App-to-Intune.ps1` uses token with `Invoke-RestMethod` for Graph calls.
    6.  Script executes, returns result.
    7.  Temporary PowerShell process terminates.
*   **Key Components:** `api/api.py`, `Front-end/src/services/authService.ts`, `Front-end/src/pages/AuthCallbackPage.tsx`, `Front-end/src/TenantContext.tsx`, `scripts/Add-App-to-Intune.ps1`.
*   **Security:** PKCE, signed HTTP-only cookies.

## Next Steps (Project Development)
*   **Testing:** Thoroughly test the deployment flow using the refactored `Add-App-to-Intune.ps1` script via the UI/API to confirm the 401 error is resolved. Test with different detection/requirement rules. Test token refresh scenarios during deployment.
*   **Fix Frontend State Update:** Diagnose and fix why the frontend UI (`TenantContext`) doesn't update automatically after successful OAuth login/redirect.
*   **Replace Placeholders:** User MUST replace `YOUR_CLIENT_ID_HERE`, `YOUR_TENANT_ID_HERE`, `YOUR_CLIENT_SECRET_HERE`, and `YOUR_SECRET_KEY_HERE_REPLACE_ME` in `api/api.py` and `Front-end/src/config.ts`.
*   **Update Other Scripts:** Review `Package-MSI.ps1` and `Winget-InstallPackage.ps1` to ensure they accept/use `-AccessToken` if they interact with Intune/Graph.
*   **Frontend Status/Error Handling:** Improve frontend feedback for deployment errors originating from the Graph API calls in the script.
*   **Large File Uploads:** The current script uses a single PUT for file upload. Implement chunked uploading in `Add-App-to-Intune.ps1` for reliability with larger `.intunewin` files.
*   **Refine UI:** Continue UI refinements.
*   **Security Hardening:** Use environment variables for secrets, restrict CORS, validate input.
