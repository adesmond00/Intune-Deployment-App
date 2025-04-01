# Progress: Intune Deployment Toolkit

## What Works / Exists

*   **Frontend Shell & Routing**: A basic React application structure exists (`Front-end/`) using Vite and TypeScript. It includes:
    *   A header and a functional, collapsible sidebar (`Front-end/src/components/Sidebar.tsx`) styled with TailwindCSS.
    *   Client-side routing implemented using `react-router-dom`.
    *   Routes defined for `/` (Dashboard) and `/applications`.
    *   A placeholder `DashboardPage` component (`Front-end/src/pages/DashboardPage.tsx`).
    *   An `ApplicationsPage` component (`Front-end/src/pages/ApplicationsPage.tsx`) with a welcome message and navigation links/buttons.
    *   A `WingetAppPage` component (`Front-end/src/pages/WingetAppPage.tsx`) providing:
        *   UI for searching Winget apps via the `/winget-search` API.
        *   Correct handling and display of search results (parsing the nested `results` array from the API response).
        *   Ability to "stage" apps into a separate list.
        *   Basic loading and error handling for the search.
        *   Placeholder "Deploy" button.
    *   Functional navigation links in the sidebar and on the Applications page.
    *   Configuration file (`Front-end/src/config.ts`) for API base URL.
*   **Backend API Foundation**: A FastAPI application (`api/`) is set up with basic endpoints:
    *   `/`: Welcome message.
    *   `/winget-search`: Accepts a search term via `GET` request query parameter (`?term=...`) and uses `api/winget.py` to execute `winget search`, returning parsed results. (Method changed from POST to GET, syntax error fixed).
    *   `/execute-script`: Accepts a script path and parameters via `POST`, executes the specified PowerShell script using `subprocess.Popen`, and returns stdout/stderr. This is a generic executor.
    *   **CORS Configuration**: Permissive CORS middleware added via `api/middleware.py` and applied in `api/api.py` to allow frontend requests during development (includes warnings for production).
*   **Winget Search Logic**: The `api/winget.py` module successfully calls `winget search`, parses the output into a structured list of applications, and no longer contains the unused `WingetSearch` Pydantic model.
*   **Intune Connection Script**: `scripts/Connect-to-Intune.ps1` provides a function to install necessary modules (`IntuneWin32App`, `Microsoft.Graph.Intune`) and connect to Intune using interactive authentication.
*   **Add App Script**: `scripts/Add-App-to-Intune.ps1` provides a function that wraps `Add-IntuneWin32App`, accepting parameters needed to define a Win32 app in Intune (requires a pre-existing `.intunewin` file).
*   **Winget Install/Uninstall Script**: `scripts/Winget-InstallPackage.ps1` is a relatively complete and robust script for installing or uninstalling applications via `winget`. It handles:
    *   Running as 64-bit.
    *   Logging.
    *   Detecting and installing `winget` itself if missing (including downloading/extracting the MSIX bundle and handling dependencies like Visual C++ Redistributable).
    *   Executing `winget install` or `winget uninstall` with appropriate arguments.

## What's Missing / Incomplete / Needs Work

*   **Frontend Functionality**:
    *   The Winget search/staging UI (`WingetAppPage`) is functional but the "Deploy" button is a placeholder.
    *   The "Add an App with Scoop" button on `ApplicationsPage` is not wired up.
    *   No components exist for adding/configuring custom MSI/EXE applications.
    *   No UI exists for displaying deployment status/feedback beyond basic search errors.
*   **Backend Orchestration Logic**: The API currently only executes *single* scripts (`/execute-script`) or performs searches (`/winget-search`). It lacks the higher-level logic to orchestrate the full deployment workflow (e.g., take staged apps list -> trigger packaging -> trigger Intune upload/creation).
*   **Packaging Logic**: `scripts/Package-MSI.ps1` is incomplete. It needs the actual implementation to use the `IntuneWin32App` module (specifically `New-IntuneWin32AppPackage`) to create the `.intunewin` file from source files (like MSI/EXE).
*   **Integration**: The frontend Winget search is integrated with the backend `/winget-search` API. However, the deployment step (frontend "Deploy" button to backend orchestration) is not integrated.
*   **`main.ps1`**: This file is empty and its purpose is undefined.
*   **Error Handling**: No comprehensive error handling across the frontend-API-script layers.
*   **Security**:
    *   API endpoint for script execution (`/execute-script`) is insecure.
    *   Intune connection uses interactive auth, unsuitable for automation.
    *   CORS configuration is currently permissive (`allow_origins=["*"]`) and needs restriction for production.
*   **Asynchronous Operations**: No handling for potentially long-running packaging/upload tasks.
*   **State Persistence**: Backend uses in-memory lists; needs persistent storage if required.
*   **Configuration Management**: How settings like TenantID are managed is unclear (hardcoded ClientID in `Connect-to-Intune.ps1`, TenantID passed as param).

## Known Issues
*   None explicitly documented, but the incompleteness of major components (packaging, orchestration, UI functionality) is the primary "issue".
*   Security vulnerabilities in the current `/execute-script` endpoint design.
*   (Resolved) The `/winget-search` endpoint previously accepted POST instead of GET.
*   (Resolved) Syntax error in `api/api.py` related to the `/winget-search` modification.
*   (Resolved) Frontend failed to display search results due to incorrect parsing of the API response structure.
