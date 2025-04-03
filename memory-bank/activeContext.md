# Active Context: Intune Deployment Toolkit

## Current Focus
Implemented PKCE (Proof Key for Code Exchange) in the OAuth 2.0 flow to address Azure AD security requirements (`AADSTS9002325` error).

## Recent Activity
*   **Implemented PKCE:**
    *   Modified `/auth/login` in `api/api.py`: Generates `code_verifier` and `code_challenge`, stores `code_verifier` in the signed state cookie, and adds `code_challenge` / `code_challenge_method` to the authorization URL.
    *   Modified `/auth/callback` in `api/api.py`: Retrieves `code_verifier` from the state cookie and includes it in the token exchange request.
*   **Resolved Import Errors:**
    *   Corrected relative imports in `api/api.py` (e.g., `from .winget import ...`).
    *   Simplified `api/__init__.py`.
    *   Removed unused imports from deprecated `powershell_session.py` in `api/api.py`.
    *   Updated FastAPI app initialization to use `lifespan` context manager instead of deprecated `@app.on_event`.
    *   Identified that running `uvicorn` from the project root (not inside `/api`) and without `--reload` resolves module loading issues in the user's environment.
*   **Implemented OAuth 2.0 Authentication Flow:** (Previous)
    *   Replaced backend interactive PowerShell login.
    *   **Frontend:** Installed `@azure/msal-browser`, modified `authService.ts`, `SettingsModal.tsx`, `TenantContext.tsx` for redirect flow and status checking. Removed unused `AuthResponse` interface.
    *   **Backend (`api/api.py`):** Added auth endpoints, session cookie handling (`itsdangerous`), token refresh logic, `get_current_session` dependency. Modified `/intune/status` and `/execute-script`. Added placeholders. Installed dependencies in `.venv`.
    *   **PowerShell (`scripts/`):** Refactored `Connect-to-Intune.ps1` for module checks. Modified `Add-App-to-Intune.ps1` to use `-AccessToken`.
    *   **Session Management (`api/powershell_session.py`):** Deprecated persistent session logic.

*   **(Previous)** Adjusted Command Line Display & Fixed Modals/Dark Mode.

## Next Steps (Project Development)
*   **Replace Placeholders:** User needs to replace `YOUR_CLIENT_ID_HERE`, `YOUR_TENANT_ID_HERE`, `YOUR_CLIENT_SECRET_HERE`, and `YOUR_SECRET_KEY_HERE_REPLACE_ME` in `api/api.py` and `Front-end/src/config.ts`.
*   **Testing:** Thoroughly test the login/logout flow (now with PKCE) and script execution using the acquired token.
*   **Update Other Scripts:** Review other PowerShell scripts (`Package-MSI.ps1`, `Winget-InstallPackage.ps1`) for potential `-AccessToken` updates.
*   **Frontend Status/Error Handling:** Improve frontend feedback for auth errors.
*   **Deployment Logic:** Implement deployment orchestration.
*   **Refine UI:** Continue UI refinements.
*   **Security:** Use environment variables for secrets, restrict CORS for production.
