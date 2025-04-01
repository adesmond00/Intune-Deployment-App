# System Patterns: Intune Deployment Toolkit

## Overall Architecture
The toolkit follows a **Client-Server architecture**:

```mermaid
graph LR
    A[React Frontend (Client)] -- HTTP Requests --> B(FastAPI Backend API);
    B -- Executes --> C{PowerShell Scripts};
    C -- Interacts with --> D[Microsoft Intune (Graph API)];
    C -- Interacts with --> E[winget.exe];
    B -- Calls --> F[winget.py (for search)];
    F -- Executes --> E;
```

*   **Client (Frontend)**: The React application running in the user's browser provides the user interface for interaction.
*   **Server (Backend API)**: The FastAPI application acts as the central hub. It receives requests from the frontend, processes them, and orchestrates the execution of backend logic (primarily PowerShell scripts).
*   **Execution Layer (Scripts)**: PowerShell scripts encapsulate specific tasks related to Intune interaction (connection, packaging, deployment) and local system operations (like running `winget`).

## Key Patterns and Decisions

1.  **API Facade**: The FastAPI backend serves as a facade, providing a simplified RESTful interface (`/winget-search`, `/execute-script`) over the more complex underlying PowerShell operations. This decouples the frontend from the specifics of PowerShell scripting and Intune modules.

2.  **Script-Based Logic**: Core Intune operations and interactions with tools like `winget` are implemented as separate PowerShell scripts (`scripts/`). This promotes modularity and allows scripts to be potentially tested or run independently. The API acts as an orchestrator for these scripts.

3.  **External Tool Integration**: The system integrates with external command-line tools:
    *   `winget.exe`: Leveraged for application searching (via `api/winget.py`) and installation/uninstallation (via `scripts/Winget-InstallPackage.ps1`). The installation script includes robust handling for cases where `winget` might not be present or requires specific dependencies (like Visual C++ Redistributable).
    *   `IntuneWin32App` module cmdlets: Used for packaging and deploying Win32 apps.

4.  **Configuration via Parameters**: PowerShell scripts are designed to be parameterized (`Add-App-to-Intune.ps1`, `Winget-InstallPackage.ps1`), allowing the API layer to pass necessary configuration details (like display names, install commands, package IDs) during execution.

5.  **State Management (Implicit)**:
    *   Frontend state is managed within React components (e.g., `useState` in `App.tsx` for sidebar visibility). More complex state management might be needed as features grow.
    *   Backend state (like the `deployments` list in `api.py`) is currently in-memory, suitable for development but needs replacement with persistent storage (e.g., database, configuration files) for production use.
    *   The primary "state" related to Intune deployments resides within the Microsoft Intune service itself.

## Potential Challenges/Areas for Improvement
*   **Error Handling**: Robust error handling needs to be implemented across all layers (Frontend -> API -> Scripts) and propagated back to the user effectively.
*   **Security**: Executing arbitrary PowerShell scripts via an API endpoint (`/execute-script`) needs careful security considerations (input validation, limiting script paths, authentication/authorization). The current implementation appears very open. Connecting to Intune (`Connect-to-Intune.ps1`) uses interactive login, which might not be suitable for a fully automated backend process; service principal or certificate-based authentication might be required.
*   **Long-Running Operations**: Packaging and uploading large applications can take time. The API needs to handle these potentially long-running tasks asynchronously to avoid blocking the frontend (e.g., using background tasks in FastAPI).
*   **State Persistence**: The in-memory deployment list in `api.py` is not persistent.
