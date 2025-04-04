# System Patterns: Intune Deployment Toolkit

## Overall Architecture
The toolkit follows a **Client-Server architecture**:

```mermaid
graph LR
    A[React Frontend (Client)] -- HTTP Requests --> B(FastAPI Backend API);
    A -- Redirects User --> G[Microsoft Login];
    G -- Redirects User (Code+State) --> B;
    B -- Exchanges Code --> G[Microsoft Token Endpoint];
    B -- Sets Session Cookie --> A;
    A -- API Calls with Cookie --> B;
    B -- Executes --> C{PowerShell Scripts (with Access Token)};
    C -- Interacts with --> D[Microsoft Intune (Graph API)];
    C -- Interacts with --> E[winget.exe];
    B -- Calls --> F[winget.py (for search)];
    F -- Executes --> E;
```

*   **Client (Frontend)**: The React application (`Front-end/`) running in the user's browser handles UI and initiates the login process by redirecting to the backend.
*   **Server (Backend API)**: The FastAPI application (`api/`) orchestrates the OAuth 2.0 Authorization Code flow with PKCE, interacts with Microsoft identity platform, manages user sessions via secure, signed, HTTP-only cookies, and executes PowerShell scripts.
*   **Authentication**: Handled via Microsoft Entra ID (Azure AD) using OAuth 2.0. The backend manages tokens and session state.
*   **Execution Layer (Scripts)**: PowerShell scripts (`scripts/`) are executed in *temporary* processes by the backend. They receive a valid Microsoft Graph access token via a parameter (`-AccessToken`) to authenticate their own API calls to Intune.

## Key Patterns and Decisions

1.  **API Facade**: The FastAPI backend serves as a facade, providing a simplified RESTful interface (`/winget-search`, `/execute-script`) over the more complex underlying PowerShell operations. This decouples the frontend from the specifics of PowerShell scripting and Intune modules.

2.  **Script-Based Logic**: Core Intune operations and interactions with tools like `winget` are implemented as separate PowerShell scripts (`scripts/`). The API acts as an orchestrator, launching these scripts in temporary processes and providing authentication context (a valid Graph API access token) via parameters. This promotes modularity.

3.  **External Tool Integration**: The system integrates with external command-line tools:
    *   `winget.exe`: Leveraged for application searching (via `api/winget.py`) and installation/uninstallation (via `scripts/Winget-InstallPackage.ps1`). The installation script includes robust handling for cases where `winget` might not be present or requires specific dependencies (like Visual C++ Redistributable).
    *   Microsoft Graph API: The `Add-App-to-Intune.ps1` script now uses direct `Invoke-RestMethod` calls to the Graph API for deploying Win32 apps, bypassing the `IntuneWin32App` module for this task. Packaging might still use related tools/modules.

4.  **Configuration via Parameters**: PowerShell scripts are designed to be parameterized (`Add-App-to-Intune.ps1`, `Winget-InstallPackage.ps1`). The API layer passes necessary configuration details (like display names, install commands, package IDs) and crucially, the **`-AccessToken`** parameter. The `Add-App-to-Intune.ps1` script uses this token directly to authenticate its Microsoft Graph API calls.

5.  **State Management**:
    *   **Authentication State**: Managed by the backend using secure, signed, HTTP-only session cookies (`itsdangerous`). These cookies store refresh tokens, access tokens, expiry times, and tenant ID, enabling persistent sessions and automatic token refresh.
    *   **Frontend State**: Managed within React components (e.g., `useState`, `useContext` like `TenantContext`).
    *   **Application Data State**: Backend state (like the `deployments` list in `api.py`) is currently in-memory and non-persistent.
    *   **Intune State**: The primary source of truth for deployment status resides within the Microsoft Intune service.

## Potential Challenges/Areas for Improvement
*   **Error Handling**: Robust error handling needs to be implemented across all layers (Frontend -> API -> Scripts -> Microsoft Graph) and propagated back to the user effectively, especially for OAuth and token refresh failures.
*   **Security**: While authentication is handled securely via OAuth and session cookies, the `/execute-script` endpoint still needs careful input validation and potentially limiting which scripts can be executed to prevent security risks. Ensure appropriate CORS policies for production. Use environment variables for all secrets.
*   **Long-Running Operations**: Packaging and uploading large applications can take time. The API needs to handle these potentially long-running tasks asynchronously (e.g., using background tasks in FastAPI) to avoid blocking the frontend and handle potential timeouts.
*   **State Persistence**: The in-memory deployment list in `api.py` is not persistent.
*   **Script Token Handling**: Ensure all scripts that interact with Intune/Graph are updated to accept and use the `-AccessToken` parameter correctly.
