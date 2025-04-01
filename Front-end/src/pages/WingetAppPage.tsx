/**
 * WingetAppPage Component
 *
 * This page provides an interface for searching Winget applications via the backend API,
 * viewing the search results, and staging selected applications for potential deployment.
 * It features a two-column layout:
 * - Left Column: Search input, search button, loading/error indicators, and search results.
 * - Right Column: List of applications staged for deployment and a placeholder deploy button.
 */
import React, { useState } from 'react';
import { API_BASE_URL } from '../config'; // Import the configurable API base URL
import DeploymentConfigModal from '../components/DeploymentConfigModal'; // Import the modal component

/**
 * Interface representing the structure of a Winget application object
 * returned by the backend API's /winget-search endpoint.
 * NOTE: Keys are lowercase to match the actual JSON response.
 */
interface WingetApp {
  name: string;
  id: string;
  version: string;
  source?: string;
}

/**
 * Interface representing the structure of the response object
 * returned by the backend API's /winget-search endpoint.
 */
interface WingetSearchResponse {
  status: string; // Indicates success or failure
  results: WingetApp[]; // The array of application results
  message?: string; // Optional message (e.g., "No results found")
}

/**
 * Interface representing the structured information needed for a staged deployment.
 * This holds data gathered initially and potentially edited by the user before deployment.
 * It aligns with parameters needed by the Add-AppToIntune PowerShell script.
 * Fields requiring dedicated UI later are initialized to null or defaults.
 */
interface StagedAppDeploymentInfo {
  displayName: string; // Maps to $DisplayName, initially from wingetApp.name
  id: string;          // The Winget ID, potentially used for install/uninstall commands
  version: string;     // Version info from winget search
  publisher: string | null; // Maps to $Publisher, initially null
  description: string | null; // Maps to $Description, initially null
  installCommandLine: string | null; // Maps to $InstallCommandLine, initially null
  uninstallCommandLine: string | null; // Maps to $UninstallCommandLine, initially null
  detectionRuleNotes: string | null; // Placeholder for detection rule info, initially null
  requirementRuleNotes: string | null; // Placeholder for requirement rule info, initially null
  installExperience: 'system' | 'user'; // Maps to $InstallExperience, default 'system'
  restartBehavior: 'suppress' | 'force' | 'basedOnReturnCode'; // Maps to $RestartBehavior, default 'suppress'
}


const WingetAppPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchResults, setSearchResults] = useState<WingetApp[]>([]);
  const [stagedApps, setStagedApps] = useState<StagedAppDeploymentInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setError('Please enter a search term.');
      setSearchResults([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    setSearchResults([]);

    try {
      const apiUrl = `${API_BASE_URL}/winget-search?term=${encodeURIComponent(searchTerm)}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const responseData: WingetSearchResponse = await response.json();

      if (responseData.status === 'success') {
        setSearchResults(responseData.results || []);
      } else {
        throw new Error(responseData.message || 'API returned non-success status');
      }

    } catch (err) {
      console.error('Error fetching Winget apps:', err);
      setError(
        err instanceof Error ? err.message : 'An unknown error occurred during search.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const createLogFileName = (appName: string): string => {
    return appName.replace(/\s+/g, '_').replace(/[\\/*?:"<>|]/g, '');
  };

  const handleAddApp = (appToAdd: WingetApp) => {
    if (!stagedApps.some((stagedApp) => stagedApp.id === appToAdd.id)) {
      const logFileNameBase = createLogFileName(appToAdd.name);
      const installCmd = `powershell.exe -executionpolicy bypass -file Winget-InstallPackage.ps1 -mode install -PackageID "${appToAdd.id}" -Log "${logFileNameBase}_install.log"`;
      const uninstallCmd = `powershell.exe -executionpolicy bypass -file Winget-InstallPackage.ps1 -mode uninstall -PackageID "${appToAdd.id}" -Log "${logFileNameBase}_uninstall.log"`;

      const newStagedApp: StagedAppDeploymentInfo = {
        displayName: appToAdd.name,
        id: appToAdd.id,
        version: appToAdd.version,
        publisher: null,
        description: null,
        installCommandLine: installCmd,
        uninstallCommandLine: uninstallCmd,
        detectionRuleNotes: null,
        requirementRuleNotes: null,
        installExperience: 'system',
        restartBehavior: 'suppress',
      };
      setStagedApps([...stagedApps, newStagedApp]);
    } else {
      console.log(`App "${appToAdd.name}" is already staged.`);
    }
  };

  const handleUpdateStagedApp = (index: number, updatedApp: StagedAppDeploymentInfo) => {
    setStagedApps((currentApps) => {
      const newApps = [...currentApps];
      if (index >= 0 && index < newApps.length) {
        newApps[index] = updatedApp;
      }
      return newApps;
    });
  };

  return (
    <div className="p-6">
      {/* Apply dark mode text color */}
      <h1 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Add Application via Winget</h1>

      <div className="flex flex-col md:flex-row gap-6">

        {/* Left Column: Search and Results */}
        {/* Apply dark mode background and text color */}
        <div className="flex-1 bg-white dark:bg-gray-800 p-4 rounded shadow">
          <h2 className="text-xl font-medium mb-3 text-gray-900 dark:text-gray-100">Search Available Apps</h2>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Enter app name or ID..."
              // Apply dark mode styles for input
              className="flex-grow p-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Loading Indicator - Apply dark mode text */}
          {isLoading && <div className="text-center p-4 text-gray-600 dark:text-gray-300">Loading results...</div>}

          {/* Error Display - Apply dark mode text/bg */}
          {error && <div className="text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900 dark:bg-opacity-30 p-3 rounded mb-4">{error}</div>}

          {/* Search Results List */}
          {!isLoading && !error && searchResults.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {searchResults.map((app) => (
                // Apply dark mode styles for result items
                <div
                  key={app.id}
                  className="group flex justify-between items-center p-3 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <div className="text-gray-900 dark:text-gray-100">
                    <p className="font-medium">{app.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">ID: {app.id}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Version: {app.version}</p>
                    {app.source && <p className="text-xs text-gray-500 dark:text-gray-400">Source: {app.source}</p>}
                  </div>
                  <button
                    onClick={() => handleAddApp(app)}
                    className="px-3 py-1 bg-green-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-green-600"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* No Results Message - Apply dark mode text */}
          {!isLoading && !error && searchResults.length === 0 && searchTerm && (
             <div className="text-center p-4 text-gray-500 dark:text-gray-400">No applications found matching your search.</div>
          )}
        </div>

        {/* Right Column: Staged Apps */}
        {/* Apply dark mode background and text color */}
        <div className="w-full md:w-1/3 bg-white dark:bg-gray-800 p-4 rounded shadow">
          <h2 className="text-xl font-medium mb-3 text-gray-900 dark:text-gray-100">Apps to Deploy ({stagedApps.length})</h2>
          {stagedApps.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 italic">No apps added yet. Use the search results to add apps here.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
              {/* Apply dark mode styles for staged items */}
              {stagedApps.map((stagedApp) => (
                <div key={stagedApp.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100">
                  <p className="font-medium text-base mb-1">{stagedApp.displayName}</p>
                  <p><span className="font-semibold">ID:</span> {stagedApp.id}</p>
                  <p><span className="font-semibold">Version:</span> {stagedApp.version}</p>
                  <p><span className="font-semibold">Publisher:</span> {stagedApp.publisher || <span className="italic text-gray-500 dark:text-gray-400">(Not set)</span>}</p>
                  <p><span className="font-semibold">Description:</span> {stagedApp.description || <span className="italic text-gray-500 dark:text-gray-400">(Not set)</span>}</p>
                  <p><span className="font-semibold">Install Cmd:</span> {stagedApp.installCommandLine || <span className="italic text-gray-500 dark:text-gray-400">(Not set)</span>}</p>
                  <p><span className="font-semibold">Uninstall Cmd:</span> {stagedApp.uninstallCommandLine || <span className="italic text-gray-500 dark:text-gray-400">(Not set)</span>}</p>
                  <p><span className="font-semibold">Detection:</span> {stagedApp.detectionRuleNotes || <span className="italic text-gray-500 dark:text-gray-400">(Not set)</span>}</p>
                  {/* Optional: Add a "Remove" button here later */}
                </div>
              ))}
            </div>
          )}

          {stagedApps.length > 0 && (
             <button
                onClick={() => setIsConfigModalOpen(true)}
                className="w-full px-4 py-2 mt-4 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400"
             >
                Configure & Deploy Staged Apps ({stagedApps.length})
             </button>
          )}
        </div>

      </div>

      <DeploymentConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        appsToConfigure={stagedApps}
        onUpdateApp={handleUpdateStagedApp}
      />
    </div>
  );
};

export default WingetAppPage;
