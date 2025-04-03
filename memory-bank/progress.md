# Progress: Intune Deployment Toolkit

## What Works / Exists

*   **Frontend Shell & Routing**: Basic React app structure with routing, sidebar, header, pages (`Dashboard`, `Applications`, `WingetApp`).
*   **Winget Search/Staging UI**: `WingetAppPage` allows searching via backend API, displaying results, staging apps with auto-generated command lines, and opening configuration modal.
*   **Deployment Configuration UI**: `DeploymentConfigModal` allows editing basic app parameters (`displayName`, `description`, etc.) with conditional display of command lines.
*   **Dark Mode**: Functional dark mode toggle via `ThemeContext` and `SettingsModal`.
*   **Backend API Foundation**: FastAPI app (`api/`) with CORS.
    *   `/winget-search`: Functional endpoint using `api/winget.py`.
    *   **OAuth 2.0 Authentication Flow (with PKCE)**:
        *   `/auth/login`: Initiates redirect to Microsoft login, includes PKCE challenge, sets state+verifier cookie.
        *   `/auth/callback`: Handles Microsoft redirect, validates state, exchanges code+verifier for tokens, sets secure session cookie.
        *   `/auth/logout`: Clears session cookie, redirects to Microsoft logout.
        *   Session management via signed HTTP-only cookies (`itsdangerous`).
        *   Automatic access token refresh using refresh tokens.
        *   `get_current_session` dependency protects endpoints and provides session data.
    *   `/intune/status`: Reports authentication status based on valid session cookie.
    *   `/execute-script`: Executes PowerShell scripts in *temporary* processes, passing the access token from the session via `-AccessToken` parameter.
*   **Winget Search Logic**: `api/winget.py` correctly parses `winget search` output.
*   **PowerShell Scripts**:
    *   `Add-App-to-Intune.ps1`: Updated to accept `-AccessToken` parameter and use `Connect-MgGraph -AccessToken`. Outputs JSON result.
    *   `Connect-to-Intune.ps1`: Refactored to only check/install required modules (`Microsoft.Graph.Authentication`, `IntuneWin32App`). Outputs JSON status.
    *   `Winget-InstallPackage.ps1`: Robust script for winget install/uninstall (currently runs standalone).
*   **Configuration Placeholders**: Placeholders added for Azure AD details and session secret key in `api/api.py` and `Front-end/src/config.ts`.
*   **Virtual Environment**: Backend dependencies installed in `api/.venv`.
*   **Build/Run Fixes**: Corrected relative imports, simplified `__init__.py`, updated to FastAPI `lifespan` events, identified correct `uvicorn` command structure (run from project root, without `--reload` initially to diagnose).

## What's Missing / Incomplete / Needs Work

*   **Configuration Values**: **User MUST replace placeholder values** for `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET`, and `ITSANGEROUS_SECRET_KEY` in `api/api.py` and `Front-end/src/config.ts`.
*   **Testing**: The new authentication flow (with PKCE) and token-based script execution require thorough testing.
*   **Frontend Functionality**:
    *   Deployment confirmation/triggering from `DeploymentConfigModal` is not implemented.
    *   "Add an App with Scoop" and custom MSI/EXE features are not implemented.
    *   UI for deployment status/feedback needs implementation.
    *   Improved handling of potential auth errors surfaced in URL query params after callback redirect.
*   **Backend Orchestration Logic**: No high-level logic exists yet to orchestrate the full deployment workflow (staging -> packaging -> Intune creation).
*   **Packaging Logic**: `scripts/Package-MSI.ps1` is incomplete (needs `New-IntuneWin32AppPackage` implementation).
*   **PowerShell Script Updates**: Other scripts (`Package-MSI.ps1`, potentially `Winget-InstallPackage.ps1` if Intune context is needed) may need updating to accept `-AccessToken`.
*   **`main.ps1`**: Purpose undefined.
*   **Error Handling**: Comprehensive error handling across layers still needed.
*   **Security**: Production deployment requires using environment variables for secrets, stricter CORS, etc.
*   **Asynchronous Operations**: Handling for long-running packaging/upload tasks is not implemented.
*   **State Persistence**: Backend uses in-memory lists for deployments; needs persistent storage if required beyond Intune's state.

## Known Issues
*   **(Resolved)** "Connect to Tenant" feature hung due to attempting interactive PowerShell login from the backend. Replaced with OAuth 2.0 flow + PKCE.
*   **(Resolved)** Backend failed to load (`ModuleNotFoundError`, `ImportError`) due to incorrect Uvicorn command execution directory/flags and missing/incorrect imports. Corrected imports and run command.
*   **(Resolved)** Azure AD required PKCE (`AADSTS9002325`). Implemented PKCE in backend auth flow.
*   **(Previous/Resolved)** Various issues related to Winget search API method, response parsing, CORS, etc.
