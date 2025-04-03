# Active Context: Intune Deployment Toolkit

## Current Focus
Completed major refactoring of the authentication mechanism to resolve the hanging "Connect to Tenant" issue.

## Recent Activity
*   **Implemented OAuth 2.0 Authentication Flow:**
    *   Replaced the previous backend-driven interactive PowerShell login (`Connect-MSIntuneGraph -Interactive` via persistent session) which was causing hangs.
    *   **Frontend:**
        *   Installed `@azure/msal-browser`.
        *   Modified `authService.ts`: `login` and `logout` now redirect the browser to backend endpoints (`/auth/login`, `/auth/logout`).
        *   Modified `SettingsModal.tsx`: Buttons now trigger `authService.login`/`logout`.
        *   Refactored `TenantContext.tsx`: Removed direct `connect`/`disconnect`; added `checkStatus` which calls backend `/intune/status` on load to verify authentication state based on session cookie.
    *   **Backend (`api/api.py`):**
        *   Added Azure AD configuration placeholders (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET`) and a placeholder `ITSANGEROUS_SECRET_KEY`. **These MUST be replaced with real values.**
        *   Installed dependencies (`httpx`, `python-jose`, `python-multipart`, `itsdangerous`) into a new virtual environment (`api/.venv`).
        *   Added `/auth/login` endpoint: Initiates OAuth flow, sets state cookie, redirects to Microsoft.
        *   Added `/auth/callback` endpoint: Handles redirect from Microsoft, validates state, exchanges auth code for tokens (access + refresh), stores tokens in a secure, signed HTTP-only session cookie (`itsdangerous`). Redirects back to frontend.
        *   Added `/auth/logout` endpoint: Clears session cookie, redirects to Microsoft logout.
        *   Added `get_current_session` dependency: Reads session cookie, validates signature, handles automatic access token refresh using the refresh token. Protects relevant endpoints.
        *   Modified `/intune/status` endpoint: Now relies on `get_current_session` dependency to report status based on valid session cookie.
        *   Modified `/execute-script` endpoint: Now uses `get_current_session` to get a valid access token and passes it as `-AccessToken` parameter when executing PowerShell scripts in *temporary* processes (using `asyncio.create_subprocess_exec`).
    *   **PowerShell (`scripts/`):**
        *   Refactored `Connect-to-Intune.ps1`: Removed connection logic; now focuses only on ensuring required modules (`Microsoft.Graph.Authentication`, `IntuneWin32App`) are installed.
        *   Modified `Add-App-to-Intune.ps1`: Added mandatory `-AccessToken` parameter; uses `Connect-MgGraph -AccessToken` for authentication within the script. Added JSON output handling.
    *   **Session Management (`api/powershell_session.py`):** Removed the `PowerShellSessionManager` class and persistent session logic as it's no longer used for authentication or primary script execution. File kept as deprecated placeholder.

*   **(Previous)** Adjusted Command Line Display & Fixed Modals/Dark Mode.

## Next Steps (Project Development)
*   **Replace Placeholders:** User needs to replace `YOUR_CLIENT_ID_HERE`, `YOUR_TENANT_ID_HERE`, `YOUR_CLIENT_SECRET_HERE`, and `YOUR_SECRET_KEY_HERE_REPLACE_ME` in `api/api.py` and `Front-end/src/config.ts` with actual values from Azure AD App Registration and a strong secret key.
*   **Testing:** Thoroughly test the new login/logout flow and script execution using the acquired token (e.g., test adding an app via `Add-App-to-Intune.ps1`).
*   **Update Other Scripts:** Review other PowerShell scripts (`Package-MSI.ps1`, `Winget-InstallPackage.ps1` if it needs Intune context) to see if they also need modification to accept and use the `-AccessToken` parameter.
*   **Frontend Status/Error Handling:** Improve frontend feedback based on the session status and potential errors during the OAuth callback (e.g., display `auth_error` query params).
*   **Deployment Logic:** Implement the actual deployment orchestration triggered by the "Deploy" button on the `WingetAppPage`.
*   **Refine UI:** Continue refining UI components.
*   **Security:** Ensure production deployment uses environment variables for secrets, restricts CORS properly, and considers other security best practices.
