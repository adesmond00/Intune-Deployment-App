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
  name: string;  // Changed from Name
  id: string;    // Changed from Id
  version: string; // Changed from Version
  // Add other relevant fields from the API response if needed, like 'Source'
  source?: string; // Changed from Source
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
  // $IntuneWinFile is generated later, not stored here.
  // $DetectionRule and $RequirementRule objects are complex and will likely be configured differently.
}


const WingetAppPage: React.FC = () => {
  // State for the search term entered by the user
  const [searchTerm, setSearchTerm] = useState<string>('');
  // State to store the applications returned from the Winget search API
  const [searchResults, setSearchResults] = useState<WingetApp[]>([]);
  // State to store the structured deployment info for apps selected by the user for staging
  const [stagedApps, setStagedApps] = useState<StagedAppDeploymentInfo[]>([]); // Changed type
  // State to indicate if a search request is currently in progress
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // State to store any error message during the API call
  const [error, setError] = useState<string | null>(null);
  // State to control the visibility of the deployment configuration modal
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);


  /**
   * Handles the Winget application search.
   * Fetches data from the backend API's /winget-search endpoint based on the searchTerm.
   * Updates state for loading, results, and errors accordingly.
   */
  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setError('Please enter a search term.');
      setSearchResults([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    setSearchResults([]); // Clear previous results

    try {
      // Construct the API URL using the base URL from config and the search term
      const apiUrl = `${API_BASE_URL}/winget-search?term=${encodeURIComponent(searchTerm)}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        // Handle HTTP errors (e.g., 404, 500)
        throw new Error(`API request failed with status ${response.status}`);
      }

      // Parse the JSON response, expecting the WingetSearchResponse structure
      const responseData: WingetSearchResponse = await response.json();

      // Check the status from the API response (optional but good practice)
      if (responseData.status === 'success') {
        // Extract the 'results' array and update the state
        setSearchResults(responseData.results || []); // Use empty array if results is null/undefined
      } else {
        // Handle potential API-level errors indicated by the status
        throw new Error(responseData.message || 'API returned non-success status');
      }

    } catch (err) {
      // Handle network errors, JSON parsing errors, or API-level errors caught above
      console.error('Error fetching Winget apps:', err);
      setError(
        err instanceof Error ? err.message : 'An unknown error occurred during search.'
      );
    } finally {
      // Ensure loading state is turned off regardless of success or failure
      setIsLoading(false);
    }
  };

  /**
   * Adds a selected application to the staging area (right column).
   * Prevents duplicate entries based on the application ID.
   * @param appToAdd - The WingetApp object (from search results) to add to the staging list.
   */
  const handleAddApp = (appToAdd: WingetApp) => {
    // Check if an app with the same ID is already in the stagedApps list
    if (!stagedApps.some((stagedApp) => stagedApp.id === appToAdd.id)) {
      // Create the StagedAppDeploymentInfo object, mapping data from WingetApp
      // and setting defaults or null for fields requiring user input later.
      const newStagedApp: StagedAppDeploymentInfo = {
        displayName: appToAdd.name,
        id: appToAdd.id,
        version: appToAdd.version,
        publisher: null, // Requires user input or later inference
        description: null, // Requires user input
        installCommandLine: null, // Requires user input or smart default generation
        uninstallCommandLine: null, // Requires user input or smart default generation
        detectionRuleNotes: null, // Placeholder
        requirementRuleNotes: null, // Placeholder
        installExperience: 'system', // Default
        restartBehavior: 'suppress', // Default
      };
      // Add the structured deployment info to the state
      setStagedApps([...stagedApps, newStagedApp]);
    } else {
      // Optional: Provide feedback that the app is already staged using lowercase 'name'
      console.log(`App "${appToAdd.name}" is already staged.`);
    }
  };

  /**
   * Callback function passed to the modal to update the staged app data
   * in this component's state when the user makes changes in the modal form.
   * @param index - The index of the app being updated in the stagedApps array.
   * @param updatedApp - The modified StagedAppDeploymentInfo object.
   */
  const handleUpdateStagedApp = (index: number, updatedApp: StagedAppDeploymentInfo) => {
    setStagedApps((currentApps) => {
      const newApps = [...currentApps]; // Create a mutable copy
      if (index >= 0 && index < newApps.length) {
        newApps[index] = updatedApp; // Update the specific app at the index
      }
      return newApps; // Return the new array to update state
    });
  };


  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Add Application via Winget</h1>

      {/* Main two-column layout */}
      <div className="flex flex-col md:flex-row gap-6">

        {/* Left Column: Search and Results */}
        <div className="flex-1 bg-white p-4 rounded shadow">
          <h2 className="text-xl font-medium mb-3">Search Available Apps</h2>
          {/* Search Input and Button */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Enter app name or ID..."
              className="flex-grow p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              // Allow pressing Enter to trigger search
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

          {/* Loading Indicator */}
          {isLoading && <div className="text-center p-4">Loading results...</div>}

          {/* Error Display */}
          {error && <div className="text-red-600 bg-red-100 p-3 rounded mb-4">{error}</div>}

          {/* Search Results List */}
          {!isLoading && !error && searchResults.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {searchResults.map((app) => (
                <div
                  key={app.id} // Use lowercase id for key
                  className="group flex justify-between items-center p-3 border rounded hover:bg-gray-100"
                >
                  <div>
                    {/* Access properties using lowercase keys */}
                    <p className="font-medium">{app.name}</p>
                    <p className="text-sm text-gray-600">ID: {app.id}</p>
                    <p className="text-sm text-gray-600">Version: {app.version}</p>
                    {/* Optionally display the source if available */}
                    {app.source && <p className="text-xs text-gray-500">Source: {app.source}</p>}
                  </div>
                  {/* Add button appears on hover */}
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

          {/* No Results Message */}
          {!isLoading && !error && searchResults.length === 0 && searchTerm && (
             <div className="text-center p-4 text-gray-500">No applications found matching your search.</div>
          )}
        </div>

        {/* Right Column: Staged Apps */}
        <div className="w-full md:w-1/3 bg-white p-4 rounded shadow">
          <h2 className="text-xl font-medium mb-3">Apps to Deploy ({stagedApps.length})</h2>
          {stagedApps.length === 0 ? (
            <p className="text-gray-500 italic">No apps added yet. Use the search results to add apps here.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
              {/* Map over the stagedApps array containing StagedAppDeploymentInfo objects */}
              {stagedApps.map((stagedApp) => (
                <div key={stagedApp.id} className="p-3 border rounded bg-gray-50 text-sm">
                  {/* Display properties from the StagedAppDeploymentInfo object */}
                  <p className="font-medium text-base mb-1">{stagedApp.displayName}</p>
                  <p><span className="font-semibold">ID:</span> {stagedApp.id}</p>
                  <p><span className="font-semibold">Version:</span> {stagedApp.version}</p>
                  <p><span className="font-semibold">Publisher:</span> {stagedApp.publisher || <span className="italic text-gray-500">(Not set)</span>}</p>
                  <p><span className="font-semibold">Description:</span> {stagedApp.description || <span className="italic text-gray-500">(Not set)</span>}</p>
                  <p><span className="font-semibold">Install Cmd:</span> {stagedApp.installCommandLine || <span className="italic text-gray-500">(Not set)</span>}</p>
                  <p><span className="font-semibold">Uninstall Cmd:</span> {stagedApp.uninstallCommandLine || <span className="italic text-gray-500">(Not set)</span>}</p>
                  <p><span className="font-semibold">Detection:</span> {stagedApp.detectionRuleNotes || <span className="italic text-gray-500">(Not set)</span>}</p>
                  {/* Add more fields as needed */}
                  {/* Optional: Add a "Remove" button here later */}
                </div>
              ))}
            </div>
          )}

          {/* Placeholder Deploy Button */}
          {stagedApps.length > 0 && (
             <button
                onClick={() => setIsConfigModalOpen(true)} // Open the modal on click
                // disabled={stagedApps.length === 0} // Enable button only if apps are staged
                className="w-full px-4 py-2 mt-4 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400"
             >
                Configure & Deploy Staged Apps ({stagedApps.length})
             </button>
          )}
        </div>

      </div>

      {/* Render the Deployment Configuration Modal */}
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
