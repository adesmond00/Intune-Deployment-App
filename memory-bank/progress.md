# Progress: Intune Deployment Toolkit

## What Works / Exists

*   **Frontend Shell & Routing**: Basic React app structure with routing, sidebar, header, pages (`Dashboard`, `Applications`, `WingetApp`).
*   **Winget Search/Staging UI**: `WingetAppPage` allows searching via backend API, displaying results, staging apps with auto-generated command lines, and opening configuration modal.
*   **Deployment Configuration UI (`DeploymentConfigModal.tsx`)**:
    *   Allows editing basic app parameters (`displayName`, `description`, etc.).
    *   Includes CodeMirror 5 editor for custom PowerShell detection scripts with syntax highlighting.
    *   Features "Advanced Settings" toggle.
    *   Conditionally displays 32/64-bit toggle (default 32-bit) for detection script.
    *   Conditionally displays Requirement Rules section (default Win10/x64, placeholder UI).
*   **Dark Mode**: Functional dark mode toggle via `ThemeContext` and `SettingsModal`.
*   **Backend API Foundation**: FastAPI app (`api/`) with CORS.
    *   `/winget-search`: Functional endpoint using `api/winget.py`.
    *   **OAuth 2.0 Auth Flow & Session Management**:
        *   **Implemented Flow:** Standard OAuth 2.0 Authorization Code Grant with PKCE.
        *   **Backend Endpoints:** `/auth/login` (initiates flow, sets temporary state/verifier cookie), `/auth/callback` (handles redirect, exchanges code for tokens using PKCE verifier, sets session cookie), `/auth/logout` (clears session cookie).
        *   **Session Handling:** Uses secure, signed, HTTP-only session cookies (`SESSION_COOKIE_NAME` via `itsdangerous`) storing refresh token, access token, expiry, tenant ID.
        *   **Token Refresh:** Automatic refresh handled within `get_current_session` dependency using the stored refresh token. Session cookie is updated upon successful refresh.
        *   **Protected Endpoints:** `/intune/status` and `/execute-script` use `get_current_session` to ensure valid authentication and provide access token.
    *   **Script Execution:**
        *   `/execute-script` endpoint uses the validated session's access token (refreshed if necessary).
        *   Launches PowerShell scripts in *temporary, isolated processes* for each request.
        *   Passes the access token securely to the script via the `-AccessToken` parameter.
*   **Winget Search Logic**: `api/winget.py` correctly parses `winget search` output.
*   **PowerShell Scripts**:
    *   `Add-App-to-Intune.ps1`: Refactored to use direct Graph API calls. Accepts a single `-Rules` parameter (JSON string) containing combined detection/requirement rules. Parses rules using `ConvertFrom-Json`.
    *   `Connect-to-Intune.ps1`: Checks/installs modules.
    *   `Winget-InstallPackage.ps1`: Robust script for winget install/uninstall (standalone).
*   **Backend Parameter Handling**: `/execute-script` endpoint in `api/api.py` updated to process `DetectionScriptContent`, `RunDetectionScriptAs32Bit`, and `RequirementRules` from frontend. Constructs combined `Rules` list (with Base64 encoded script) and passes it as a JSON string to the `-Rules` parameter of `Add-App-to-Intune.ps1`.
*   **Frontend Dependencies**: Installed `react-codemirror2` and `codemirror@^5.0.0`.
*   **Configuration Placeholders**: Placeholders added for Azure AD details and session secret key in `api/api.py` and `Front-end/src/config.ts`.
*   **Virtual Environment**: Backend dependencies installed in `api/.venv`.
*   **Build/Run Fixes**: Corrected relative imports, simplified `__init__.py`, updated to FastAPI `lifespan` events, identified correct `uvicorn` command structure (run from project root, without `--reload` initially to diagnose).

## What's Missing / Incomplete / Needs Work

*   **Configuration Values**: **User MUST replace placeholder values** for `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET`, and `ITSANGEROUS_SECRET_KEY` in `api/api.py` and `Front-end/src/config.ts`.
*   **Testing**:
    *   UI interactions in `DeploymentConfigModal.tsx` (advanced toggle, script input, 32/64 toggle visibility, requirement rules display).
    *   Full deployment flow with custom PowerShell detection script and default requirement rules.
    *   Complete OAuth flow (login, logout, token refresh) *after* fixing the frontend UI update issue.
*   **Frontend Functionality**:
    *   **Requirement Rule UI:** Implement actual UI controls (dropdowns, inputs) in `DeploymentConfigModal` to edit requirement rules.
    *   **Data Submission:** Implement logic in `DeploymentConfigModal` to gather all configured data and trigger the backend `/execute-script` call.
    *   "Add an App with Scoop" and custom MSI/EXE features are not implemented.
    *   UI for deployment status/feedback needs implementation.
    *   Improved handling of potential OAuth errors.
*   **Backend Orchestration Logic**: No high-level logic exists yet to orchestrate the full deployment workflow (staging -> packaging -> Intune creation).
*   **Packaging Logic**: `scripts/Package-MSI.ps1` is incomplete (needs `New-IntuneWin32AppPackage` implementation and likely `-AccessToken` parameter).
*   **PowerShell Script Updates**: Other scripts (`Package-MSI.ps1`) that interact with Intune need updating to accept and use the `-AccessToken` parameter. `Winget-InstallPackage.ps1` likely does not need changes unless it requires Intune interaction.
*   **`main.ps1`**: Purpose undefined.
*   **Error Handling**: Comprehensive error handling across layers (OAuth flow, token refresh, script execution, Graph API calls) still needed.
*   **Security**: Production deployment requires using environment variables for secrets, stricter CORS, input validation on `/execute-script`.
*   **Asynchronous Operations**: Handling for long-running packaging/upload tasks is not implemented.
*   **State Persistence**: Backend uses in-memory lists for deployments; needs persistent storage if required beyond Intune's state.

## Known Issues
*   **Frontend UI Not Updating After Login:** After successful OAuth login and redirect, the frontend UI (`TenantContext`) does not automatically reflect the logged-in state. The `checkStatus` call on load might be executing before the session cookie is fully available/set by the browser after the redirect, or there could be other timing/state propagation issues within React. Requires investigation.
*   **(Resolved)** "Connect to Tenant" feature hung due to attempting interactive PowerShell login from the backend. Replaced with backend-managed OAuth 2.0 flow using session cookies and token passing.
*   **(Resolved)** Backend failed to load (`ModuleNotFoundError`, `ImportError`).
*   **(Resolved)** Azure AD required PKCE (`AADSTS9002325`).
*   **(Resolved)** Deployment failed with 401 error when using `Add-IntuneWin32App` cmdlet with token authentication. Refactored script to use direct Graph API calls.
*   **(Previous/Resolved)** Various issues related to Winget search API method, response parsing, CORS, etc.
