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

## Next Steps (Project Development)
With the Winget search UI functional and the backend API CORS configuration added, focus can shift to:
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
