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

/**
 * Interface representing the structure of a Winget application object
 * returned by the backend API's /winget-search endpoint.
 */
interface WingetApp {
  Name: string;
  Id: string;
  Version: string;
  // Add other relevant fields from the API response if needed
}

const WingetAppPage: React.FC = () => {
  // State for the search term entered by the user
  const [searchTerm, setSearchTerm] = useState<string>('');
  // State to store the applications returned from the Winget search API
  const [searchResults, setSearchResults] = useState<WingetApp[]>([]);
  // State to store the applications selected by the user for staging
  const [stagedApps, setStagedApps] = useState<WingetApp[]>([]);
  // State to indicate if a search request is currently in progress
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // State to store any error message during the API call
  const [error, setError] = useState<string | null>(null);

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

      const data: WingetApp[] = await response.json();
      setSearchResults(data);
    } catch (err) {
      // Handle network errors or JSON parsing errors
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
   * @param appToAdd - The WingetApp object to add to the staging list.
   */
  const handleAddApp = (appToAdd: WingetApp) => {
    // Check if the app (by ID) is already in the stagedApps list
    if (!stagedApps.some((app) => app.Id === appToAdd.Id)) {
      setStagedApps([...stagedApps, appToAdd]);
    } else {
      // Optional: Provide feedback that the app is already staged
      console.log(`App "${appToAdd.Name}" is already staged.`);
    }
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
                  key={app.Id}
                  className="group flex justify-between items-center p-3 border rounded hover:bg-gray-100"
                >
                  <div>
                    <p className="font-medium">{app.Name}</p>
                    <p className="text-sm text-gray-600">ID: {app.Id}</p>
                    <p className="text-sm text-gray-600">Version: {app.Version}</p>
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
              {stagedApps.map((app) => (
                <div key={app.Id} className="p-3 border rounded bg-gray-50">
                  <p className="font-medium">{app.Name}</p>
                  <p className="text-sm text-gray-600">ID: {app.Id}</p>
                  <p className="text-sm text-gray-600">Version: {app.Version}</p>
                  {/* Optional: Add a "Remove" button here later */}
                </div>
              ))}
            </div>
          )}

          {/* Placeholder Deploy Button */}
          {stagedApps.length > 0 && (
             <button
                // onClick={handleDeploy} // Placeholder for future deploy function
                disabled // Disabled for now
                className="w-full px-4 py-2 mt-4 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-400"
             >
                Deploy Staged Apps (Placeholder)
             </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default WingetAppPage;
