# Active Context: Intune Deployment Toolkit

## Current Focus
Debugging and refining existing UI features, including dark mode.

## Recent Activity
*   **Fixed Tenant Connection Modal Visibility:** Increased the `z-index` of the main container in `Front-end/src/components/TenantConnectionModal.tsx` from `z-40` to `z-60` to ensure it renders above the `SettingsModal` backdrop and content.
*   **Fixed Dark Mode Toggle:** Refined the `useEffect` hook in `Front-end/src/context/ThemeContext.tsx` to correctly add/remove the `dark` class on the `<html>` element, resolving the issue where the UI didn't visually update when the theme was toggled.
*   **Implemented Tenant Connection UI:**
    *   Added `debugMode` flag to `Front-end/src/config.ts`.
    *   Created `TenantContext` (`Front-end/src/context/TenantContext.tsx`) for global state management of tenant connection status (isConnected, tenantId, clientId, tenantName) with localStorage persistence.
    *   Integrated `TenantProvider` into `Front-end/src/App.tsx`.
    *   Updated the `Header` component in `App.tsx` to display connection status (green indicator and tenant name/ID) using `useTenant`.
    *   Created `TenantConnectionModal` (`Front-end/src/components/TenantConnectionModal.tsx`) with inputs for Client ID and Tenant ID, and a "Connect" button triggering the context update.
    *   Modified `SettingsModal` (`Front-end/src/components/SettingsModal.tsx`):
        *   Added state to manage the `TenantConnectionModal`.
        *   Conditionally displays "Connect to Tenant" button (opens `TenantConnectionModal`) or "Disconnect" button based on `isConnected` state.
        *   Added a conditional "Debugging" section (visible if `debugMode` is true) with a "Toggle Mock Connection" switch that uses `mockConnect`/`mockDisconnect` from `TenantContext`. The toggle is disabled if a real connection is active.
*   Implemented Dark Mode Foundation: (Previous activity)
    *   Enabled class-based dark mode in `tailwind.config.js`.
    *   Created `ThemeContext.tsx` to manage global theme state ('light'/'dark'), persist to localStorage, and apply/remove the `dark` class on the `<html>` element.
    *   Wrapped the application in `ThemeProvider` within `App.tsx`.
    *   Created `SettingsModal.tsx` with a toggle switch using `ThemeContext` to change the theme.
    *   Integrated `SettingsModal` into `App.tsx`, triggered via a new `onSettingsClick` prop added to `Sidebar.tsx`.
    *   Applied initial dark mode styles (`dark:` variants) to core layout components (`App.tsx`, `Header`, `Sidebar.tsx`) and pages (`DashboardPage`, `ApplicationsPage`, `WingetAppPage`, `DeploymentConfigModal`).
*   Added Deployment Configuration UI: (Previous activity)
    *   Created a new modal component `Front-end/src/components/DeploymentConfigModal.tsx`.
    *   Implemented a two-pane layout (side menu, form area).
    *   Added form fields for editing `displayName`, `description`, `publisher`, `installExperience`, `restartBehavior`.
    *   Added a `showCommandLines` boolean flag (default `false`) within the modal to conditionally display the generated command lines (currently as read-only text areas). Updated comments to reflect skipped fields (Detection/Requirement Rules).
    *   Implemented state management and event handling for editing configuration.
    *   Integrated the modal into `WingetAppPage.tsx`.
*   Structured Staging Data & Command Line Generation: (Previous activity)
    *   Enhanced the `StagedAppDeploymentInfo` interface in `WingetAppPage.tsx` to include fields relevant to the `Add-AppToIntune.ps1` script.
    *   Updated the `handleAddApp` function in `WingetAppPage.tsx` to automatically generate default `installCommandLine` and `uninstallCommandLine` strings based on the app's `id` and `name` (using `Winget-InstallPackage.ps1`) and store them in the `StagedAppDeploymentInfo` object.
*   Fixed Backend Parsing: (Previous activity) Improved the parsing logic in `api/winget.py` to reliably skip header and separator lines from the `winget search` output, preventing the header row from appearing as a result in the frontend.
*   Fixed Frontend API Handling & Display: (Previous activity)
    *   Updated `WingetAppPage.tsx` to correctly parse the nested `results` array from the `/winget-search` API response object. Added `WingetSearchResponse` interface for type safety.
    *   Corrected property access in `WingetAppPage.tsx` (interface definition and JSX rendering) to use lowercase keys (`name`, `id`, `version`, `source`) matching the actual API response, resolving the issue where results were listed but data was not displayed.
*   Fixed Backend API: (Previous activity)
    *   Modified the `/winget-search` endpoint in `api/api.py` to accept `GET` requests instead of `POST`, aligning with REST principles and resolving the `405 Method Not Allowed` error. Removed the unused `WingetSearch` Pydantic model from `api/winget.py`. Corrected a syntax error in `api/api.py` introduced during the previous modification.
    *   Added permissive CORS (Cross-Origin Resource Sharing) middleware to `api/api.py` to resolve frontend "failed to fetch" errors during local development. The configuration is defined in a new `api/middleware.py` file for modularity and includes warnings about needing stricter settings for production.
*   Created the `WingetAppPage` component (`Front-end/src/pages/WingetAppPage.tsx`) with: (Previous activity)
    *   Two-column layout (Search/Results and Staging).
    *   State management for search term, results, staged apps, loading, and errors. (Previous activity)
    *   Functionality to call the `/winget-search` backend API endpoint (using GET) via the configured base URL. (Previous activity)
    *   UI to display search results with an "Add" button (visible on hover). (Previous activity)
    *   Functionality to add selected apps to a "Staged Apps" list, preventing duplicates. (Previous activity)
    *   Placeholder "Deploy" button for staged apps. (Previous activity)
    *   Added comments and basic error handling. (Previous activity)
*   Added a new route `/applications/winget` in `Front-end/src/App.tsx` pointing to `WingetAppPage`. (Previous activity)
*   Updated the "Add an App with Winget" button in `Front-end/src/pages/ApplicationsPage.tsx` to be a `Link` component navigating to the new `/applications/winget` route. (Previous activity)
*   Created `Front-end/src/config.ts` to store the configurable `API_BASE_URL`. (Previous activity)


## Next Steps (Project Development)
With the tenant connection UI implemented, focus can shift to:
*   **Backend Tenant Connection:** Implement the actual backend logic (likely modifying `scripts/Connect-to-Intune.ps1` and adding a new API endpoint) to handle the connection using the provided Client ID and Tenant ID. This should ideally use non-interactive authentication (e.g., Service Principal) for automation.
*   **Deployment Logic:** Implement the deployment logic triggered by the "Deploy" button on the `WingetAppPage`.
*   **Refine UI:** Refine the `WingetAppPage` UI (e.g., "Remove" button for staged apps).
*   **Other Features:** Implement "Add an App with Scoop" and custom application functionality.
*   **Script Completion:** Complete `scripts/Package-MSI.ps1`.
*   **Security:** Address API security and Intune authentication method.
