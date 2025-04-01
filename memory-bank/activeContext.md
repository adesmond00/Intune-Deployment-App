# Active Context: Intune Deployment Toolkit

## Current Focus
Implementing the frontend functionality for searching and staging Winget applications.

## Recent Activity
*   Created `Front-end/src/config.ts` to store the configurable `API_BASE_URL`.
*   Created the `WingetAppPage` component (`Front-end/src/pages/WingetAppPage.tsx`) with:
    *   Two-column layout (Search/Results and Staging).
    *   State management for search term, results, staged apps, loading, and errors.
    *   Functionality to call the `/winget-search` backend API endpoint (using GET) via the configured base URL.
    *   UI to display search results with an "Add" button (visible on hover).
    *   Functionality to add selected apps to a "Staged Apps" list, preventing duplicates.
    *   Placeholder "Deploy" button for staged apps.
    *   Added comments and basic error handling.
*   Added a new route `/applications/winget` in `Front-end/src/App.tsx` pointing to `WingetAppPage`.
*   Updated the "Add an App with Winget" button in `Front-end/src/pages/ApplicationsPage.tsx` to be a `Link` component navigating to the new `/applications/winget` route.
*   **Fixed Backend API:**
    *   Modified the `/winget-search` endpoint in `api/api.py` to accept `GET` requests instead of `POST`, aligning with REST principles and resolving the `405 Method Not Allowed` error. Removed the unused `WingetSearch` Pydantic model from `api/winget.py`. Corrected a syntax error in `api/api.py` introduced during the previous modification.
    *   Added permissive CORS (Cross-Origin Resource Sharing) middleware to `api/api.py` to resolve frontend "failed to fetch" errors during local development. The configuration is defined in a new `api/middleware.py` file for modularity and includes warnings about needing stricter settings for production.
*   **Fixed Frontend API Handling & Display:**
    *   Updated `WingetAppPage.tsx` to correctly parse the nested `results` array from the `/winget-search` API response object. Added `WingetSearchResponse` interface for type safety.
    *   Corrected property access in `WingetAppPage.tsx` (interface definition and JSX rendering) to use lowercase keys (`name`, `id`, `version`, `source`) matching the actual API response, resolving the issue where results were listed but data was not displayed.
*   **Fixed Backend Parsing:** Improved the parsing logic in `api/winget.py` to reliably skip header and separator lines from the `winget search` output, preventing the header row from appearing as a result in the frontend.
*   **Structured Staging Data & Command Line Generation:**
    *   Enhanced the `StagedAppDeploymentInfo` interface in `WingetAppPage.tsx` to include fields relevant to the `Add-AppToIntune.ps1` script.
    *   Updated the `handleAddApp` function in `WingetAppPage.tsx` to automatically generate default `installCommandLine` and `uninstallCommandLine` strings based on the app's `id` and `name` (using `Winget-InstallPackage.ps1`) and store them in the `StagedAppDeploymentInfo` object.
*   **Added Deployment Configuration UI:**
    *   Created a new modal component `Front-end/src/components/DeploymentConfigModal.tsx`.
    *   Implemented a two-pane layout (side menu, form area).
    *   Added form fields for editing `displayName`, `description`, `publisher`, `installExperience`, `restartBehavior`.
    *   Added a `showCommandLines` boolean flag (default `false`) within the modal to conditionally display the generated command lines (currently as read-only text areas). Updated comments to reflect skipped fields (Detection/Requirement Rules).
    *   Implemented state management and event handling for editing configuration.
    *   Integrated the modal into `WingetAppPage.tsx`.
*   **Implemented Dark Mode Foundation:**
    *   Enabled class-based dark mode in `tailwind.config.js`.
    *   Created `ThemeContext.tsx` to manage global theme state ('light'/'dark'), persist to localStorage, and apply/remove the `dark` class on the `<html>` element.
    *   Wrapped the application in `ThemeProvider` within `App.tsx`.
    *   Created `SettingsModal.tsx` with a toggle switch using `ThemeContext` to change the theme.
    *   Integrated `SettingsModal` into `App.tsx`, triggered via a new `onSettingsClick` prop added to `Sidebar.tsx`.
    *   Applied initial dark mode styles (`dark:` variants) to core layout components (`App.tsx`, `Header`, `Sidebar.tsx`) and pages (`DashboardPage`, `ApplicationsPage`, `WingetAppPage`, `DeploymentConfigModal`).

## Next Steps (Project Development)
With the dark mode toggle functional and basic styling applied, focus can shift to:
*   Implementing the actual deployment logic triggered by the "Deploy" button on the `WingetAppPage`. This involves:
    *   Creating a new backend API endpoint (or modifying `/execute-script`) to handle the deployment orchestration (packaging, uploading, creating Intune app).
    *   Connecting the frontend "Deploy" button to this new backend logic.
    *   Implementing robust error handling and status feedback for the deployment process.
    *   Handling potentially long-running deployment tasks asynchronously.
*   Refining the `WingetAppPage` UI (e.g., adding a "Remove" button for staged apps, improving styling or error display).
*   Implementing the "Add an App with Scoop" functionality.
*   Adding functionality for adding custom applications (MSI/EXE).
*   Completing the `scripts/Package-MSI.ps1` script.
*   Addressing security concerns (API endpoint security, Intune authentication method).
