# Progress: Intune Deployment Toolkit

## What Works / Exists

*   **Frontend Shell & Routing**: A basic React application structure exists (`Front-end/`) using Vite and TypeScript. It includes:
    *   A header and a functional, collapsible sidebar (`Front-end/src/components/Sidebar.tsx`) styled with TailwindCSS.
    *   Client-side routing implemented using `react-router-dom`.
    *   Routes defined for `/` (Dashboard) and `/applications`.
    *   A placeholder `DashboardPage` component (`Front-end/src/pages/DashboardPage.tsx`).
    *   An `ApplicationsPage` component (`Front-end/src/pages/ApplicationsPage.tsx`) with a welcome message and placeholder buttons.
    *   Functional navigation links in the sidebar for Dashboard and Applications.
*   **Backend API Foundation**: A FastAPI application (`api/`) is set up with basic endpoints:
    *   `/`: Welcome message.
    *   `/winget-search`: Accepts a search term and uses `api/winget.py` to execute `winget search`, returning parsed results.
    *   `/execute-script`: Accepts a script path and parameters, executes the specified PowerShell script using `subprocess.Popen`, and returns stdout/stderr. This is a generic executor.
*   **Winget Search Logic**: The `api/winget.py` module successfully calls `winget search` and parses the output into a structured list of applications.
*   **Intune Connection Script**: `scripts/Connect-to-Intune.ps1` provides a function to install necessary modules (`IntuneWin32App`, `Microsoft.Graph.Intune`) and connect to Intune using interactive authentication.
*   **Add App Script**: `scripts/Add-App-to-Intune.ps1` provides a function that wraps `Add-IntuneWin32App`, accepting parameters needed to define a Win32 app in Intune (requires a pre-existing `.intunewin` file).
*   **Winget Install/Uninstall Script**: `scripts/Winget-InstallPackage.ps1` is a relatively complete and robust script for installing or uninstalling applications via `winget`. It handles:
    *   Running as 64-bit.
    *   Logging.
    *   Detecting and installing `winget` itself if missing (including downloading/extracting the MSIX bundle and handling dependencies like Visual C++ Redistributable).
    *   Executing `winget install` or `winget uninstall` with appropriate arguments.

## What's Missing / Incomplete / Needs Work

*   **Frontend Functionality**: While routing exists, the pages themselves lack dynamic functionality:
    *   The buttons on the `ApplicationsPage` ("Add an App with Winget", "Add an App with Scoop") are not wired up.
    *   No components exist for searching applications, displaying results, configuring details, triggering actions, or showing status.
*   **Backend Orchestration Logic**: The API currently only executes *single* scripts. It lacks the higher-level logic to orchestrate the full workflow (e.g., take UI input -> call packaging script -> call add app script).
*   **Packaging Logic**: `scripts/Package-MSI.ps1` is incomplete. It needs the actual implementation to use the `IntuneWin32App` module (specifically `New-IntuneWin32AppPackage`) to create the `.intunewin` file from source files (like MSI/EXE).
*   **Integration**: No functional connection exists between the frontend actions (e.g., button clicks) and the backend API.
*   **`main.ps1`**: This file is empty and its purpose is undefined.
*   **Error Handling**: No comprehensive error handling across the frontend-API-script layers.
*   **Security**: API endpoint for script execution is insecure. Intune connection uses interactive auth, unsuitable for automation.
*   **Asynchronous Operations**: No handling for potentially long-running packaging/upload tasks.
*   **State Persistence**: Backend uses in-memory lists; needs persistent storage if required.
*   **Configuration Management**: How settings like TenantID are managed is unclear (hardcoded ClientID in `Connect-to-Intune.ps1`, TenantID passed as param).

## Known Issues
*   None explicitly documented, but the incompleteness of major components (packaging, orchestration, UI functionality) is the primary "issue".
*   Security vulnerabilities in the current `/execute-script` endpoint design.
