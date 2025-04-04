# Active Context: Intune Deployment Toolkit

## Current Focus
Implementing custom PowerShell detection script input and requirement rules configuration in the deployment modal.

## Recent Activity
*   **Implemented Custom PowerShell Detection Script UI:**
    *   **Frontend (`DeploymentConfigModal.tsx`):**
        *   Installed `react-codemirror2` and `codemirror@^5.0.0` for CodeMirror 5 integration.
        *   Added a CodeMirror editor instance configured for PowerShell syntax highlighting to input custom detection scripts.
        *   Added an "Advanced Settings" toggle (default off).
        *   Added a 32/64-bit toggle (`runAs32Bit`, default true/32-bit) for the detection script, visible only when "Advanced Settings" is enabled. Includes informational tooltip.
        *   Added a section for Requirement Rules, visible only when "Advanced Settings" is enabled. Includes placeholder UI and defaults to Win10/x64 requirements.
        *   Updated component state to manage detection script content, 32/64-bit setting, and requirement rules.
    *   **Backend (`api/api.py`):**
        *   Updated the `/execute-script` endpoint to process parameters from the enhanced frontend modal.
        *   It now expects `DetectionScriptContent`, `RunDetectionScriptAs32Bit`, and `RequirementRules`.
        *   Constructs the `#microsoft.graph.win32LobAppPowerShellScriptDetection` rule object, Base64 encodes the script, and includes the `runAs32Bit` flag.
        *   Combines the detection rule object and the requirement rule objects into a single list.
        *   Passes this combined list as a JSON string to the `-Rules` parameter of the PowerShell script.
    *   **PowerShell (`scripts/Add-App-to-Intune.ps1`):**
        *   Modified the script to accept a single `-Rules` parameter (expecting a JSON string representing the array of rule objects).
        *   Removed the separate `-DetectionRules` and `-RequirementRules` parameters.
        *   Uses `ConvertFrom-Json` on the `$Rules` parameter and passes the resulting object array to the `rules` property in the final Graph API PATCH request.
*   **(Previous)** Resolved Deployment Authentication Error (401) by refactoring `Add-App-to-Intune.ps1` to use direct Graph API calls instead of the `IntuneWin32App` module. Updated backend and Memory Bank accordingly.
*   **(Previous)** Implemented PKCE (Proof Key for Code Exchange) in the OAuth 2.0 flow.
*   **(Previous)** Refined OAuth 2.0 Authentication & Session Management.
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
    4.  Backend passes token via `-AccessToken` and formats other parameters (including the combined `Rules` list as a JSON string).
    5.  `Add-App-to-Intune.ps1` uses token with `Invoke-RestMethod` for Graph calls, parsing the `-Rules` JSON string.
    6.  Script executes, returns result.
    7.  Temporary PowerShell process terminates.
*   **Key Components:** `api/api.py`, `Front-end/src/services/authService.ts`, `Front-end/src/pages/AuthCallbackPage.tsx`, `Front-end/src/TenantContext.tsx`, `Front-end/src/components/DeploymentConfigModal.tsx`, `scripts/Add-App-to-Intune.ps1`.
*   **Security:** PKCE, signed HTTP-only cookies.

## Next Steps (Project Development)
*   **Frontend Requirement Rule UI:** Implement actual UI controls (dropdowns, inputs) within the "Advanced Settings" -> "Requirement Rules" section of `DeploymentConfigModal.tsx` to allow users to modify the default requirement rules. Update state handling accordingly.
*   **Frontend Data Submission:** Implement the logic in `DeploymentConfigModal.tsx` to gather all configured data (basic info, detection script, runAs32Bit flag, requirement rules) and pass it to the `onUpdateApp` prop or a new submission handler that calls the backend `/execute-script` endpoint.
*   **Testing:**
    *   Thoroughly test the UI interactions in `DeploymentConfigModal.tsx` (advanced toggle, script input, 32/64 toggle visibility, requirement rules display).
    *   Test the full deployment flow with a custom PowerShell detection script and default requirement rules.
    *   Test token refresh scenarios during deployment.
*   **Fix Frontend State Update:** Diagnose and fix why the frontend UI (`TenantContext`) doesn't update automatically after successful OAuth login/redirect.
*   **Replace Placeholders:** User MUST replace `YOUR_CLIENT_ID_HERE`, `YOUR_TENANT_ID_HERE`, `YOUR_CLIENT_SECRET_HERE`, and `YOUR_SECRET_KEY_HERE_REPLACE_ME` in `api/api.py` and `Front-end/src/config.ts`.
*   **Update Other Scripts:** Review `Package-MSI.ps1` and `Winget-InstallPackage.ps1`.
*   **Frontend Status/Error Handling:** Improve feedback for deployment errors.
*   **Large File Uploads:** Implement chunked uploading in `Add-App-to-Intune.ps1`.
*   **Security Hardening:** Use environment variables, restrict CORS, validate input.
