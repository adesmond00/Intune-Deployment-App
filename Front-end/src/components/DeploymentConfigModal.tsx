/**
 * DeploymentConfigModal Component
 *
 * Provides a modal dialog interface for configuring deployment parameters
 * for applications staged from the Winget search results.
 * Features a side menu listing staged apps and a main area for configuring the selected app.
 */
import React, { useState, useEffect } from 'react';

// Assuming StagedAppDeploymentInfo is defined elsewhere (e.g., WingetAppPage or a shared types file)
// We might need to import or redefine it. For now, let's redefine it for clarity.
// TODO: Consider moving shared interfaces to a dedicated types file (e.g., src/types.ts)
interface StagedAppDeploymentInfo {
  displayName: string;
  id: string;
  version: string;
  publisher: string | null;
  description: string | null;
  installCommandLine: string | null;
  uninstallCommandLine: string | null;
  detectionRuleNotes: string | null;
  requirementRuleNotes: string | null;
  installExperience: 'system' | 'user';
  restartBehavior: 'suppress' | 'force' | 'basedOnReturnCode';
}

/**
 * Props for the DeploymentConfigModal component.
 */
interface DeploymentConfigModalProps {
  isOpen: boolean; // Controls whether the modal is visible
  onClose: () => void; // Function to call when closing the modal
  appsToConfigure: StagedAppDeploymentInfo[]; // Array of apps to configure
  onUpdateApp: (index: number, updatedApp: StagedAppDeploymentInfo) => void; // Callback to update app data in parent state
}

const DeploymentConfigModal: React.FC<DeploymentConfigModalProps> = ({
  isOpen,
  onClose,
  appsToConfigure,
  onUpdateApp,
}) => {
  // State to track the index of the currently selected app in the side menu
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // Effect to reset index when modal opens or apps change significantly
  // Prevents index out of bounds if apps are removed while modal is closed
  useEffect(() => {
    if (isOpen) {
      // Ensure selectedIndex is valid if appsToConfigure array changes size
      setSelectedIndex((prevIndex) =>
        prevIndex >= appsToConfigure.length ? Math.max(0, appsToConfigure.length - 1) : prevIndex
      );
      // If opening and list is not empty, ensure index 0 is selected if previous was invalid
      if (appsToConfigure.length > 0 && selectedIndex >= appsToConfigure.length) {
         setSelectedIndex(0);
      }
    }
  }, [isOpen, appsToConfigure.length]); // Dependency array includes length

  // Return null if the modal is not open
  if (!isOpen) {
    return null;
  }

  // Get the currently selected app, handle empty list case
  const currentApp = appsToConfigure.length > 0 ? appsToConfigure[selectedIndex] : null;

  // --- Placeholder for Form Logic ---
  // --- Form Logic ---

  /**
   * Generic handler for input changes. Updates the corresponding field
   * for the currently selected app via the onUpdateApp callback.
   * Ensures type safety for select dropdowns.
   * @param field - The key of the StagedAppDeploymentInfo field to update.
   * @param value - The new value for the field.
   */
  const handleInputChange = (
    field: keyof StagedAppDeploymentInfo,
    value: string | 'system' | 'user' | 'suppress' | 'force' // Adjusted type for select values
  ) => {
    if (!currentApp) return; // Should not happen if modal is open with apps

    // Create an updated copy of the current app data
    const updatedApp = {
      ...currentApp,
      [field]: value,
    };

    // Call the parent component's update function
    onUpdateApp(selectedIndex, updatedApp);
  };


  return (
    // Modal backdrop
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
      {/* Modal Content */}
      <div className="relative w-full max-w-4xl bg-white rounded-lg shadow-xl flex flex-col" style={{ maxHeight: '90vh' }}>

        {/* Modal Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-xl font-semibold text-gray-900">
            Configure App Deployments ({appsToConfigure.length} apps)
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
          </button>
        </div>

        {/* Modal Body (Two Panes) */}
        <div className="flex flex-1 overflow-hidden"> {/* Flex container for panes */}

          {/* Left Pane: Side Menu */}
          <div className="w-1/3 border-r overflow-y-auto p-4 space-y-2 bg-gray-50">
            <h4 className="text-lg font-medium mb-2">Staged Apps</h4>
            {appsToConfigure.map((app, index) => (
              <button
                key={app.id}
                onClick={() => setSelectedIndex(index)}
                className={`w-full text-left p-2 rounded text-sm ${
                  selectedIndex === index
                    ? 'bg-blue-100 text-blue-700 font-semibold'
                    : 'hover:bg-gray-100'
                }`}
              >
                {app.displayName}
              </button>
            ))}
             {appsToConfigure.length === 0 && <p className="text-sm text-gray-500 italic">No apps staged.</p>}
          </div>

          {/* Right Pane: Configuration Form */}
          <div className="w-2/3 overflow-y-auto p-6">
            {currentApp ? (
              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}> {/* Prevent default form submission */}
                <h4 className="text-lg font-semibold text-gray-800 border-b pb-2">{currentApp.displayName} - Configuration</h4>

                {/* Display Name */}
                <div>
                  <label htmlFor={`displayName-${currentApp.id}`} className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                  <input
                    type="text"
                    id={`displayName-${currentApp.id}`} // Unique ID for label association
                    value={currentApp.displayName}
                    onChange={(e) => handleInputChange('displayName', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor={`description-${currentApp.id}`} className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    id={`description-${currentApp.id}`} // Unique ID
                    rows={3}
                    value={currentApp.description || ''} // Handle null value
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter application description..."
                  />
                </div>

                {/* Publisher */}
                <div>
                  <label htmlFor={`publisher-${currentApp.id}`} className="block text-sm font-medium text-gray-700 mb-1">Publisher</label>
                  <input
                    type="text"
                    id={`publisher-${currentApp.id}`} // Unique ID
                    value={currentApp.publisher || ''} // Handle null value
                    onChange={(e) => handleInputChange('publisher', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter publisher name..."
                  />
                </div>

                {/* Install Experience */}
                <div>
                   <label htmlFor={`installExperience-${currentApp.id}`} className="block text-sm font-medium text-gray-700 mb-1">Install Experience</label>
                   <select
                     id={`installExperience-${currentApp.id}`} // Unique ID
                     value={currentApp.installExperience}
                     onChange={(e) => handleInputChange('installExperience', e.target.value as 'system' | 'user')}
                     className="w-full p-2 border border-gray-300 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                   >
                     <option value="system">System</option>
                     <option value="user">User</option>
                   </select>
                </div>

                {/* Restart Behavior */}
                 <div>
                   <label htmlFor={`restartBehavior-${currentApp.id}`} className="block text-sm font-medium text-gray-700 mb-1">Restart Behavior</label>
                   <select
                     id={`restartBehavior-${currentApp.id}`} // Unique ID
                     value={currentApp.restartBehavior}
                     // Only allow 'suppress' or 'force' as per requirement
                     onChange={(e) => handleInputChange('restartBehavior', e.target.value as 'suppress' | 'force')}
                     className="w-full p-2 border border-gray-300 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                   >
                     <option value="suppress">Suppress</option>
                     <option value="force">Force</option>
                     {/* <option value="basedOnReturnCode">Based on Return Code</option> -- Not requested for now */}
                   </select>
                 </div>

                 {/* --- Read Only Info --- */}
                 <div className="pt-4">
                    <p className="text-sm"><span className="font-semibold">Winget ID:</span> {currentApp.id}</p>
                    <p className="text-sm"><span className="font-semibold">Version:</span> {currentApp.version}</p>
                 </div>

                {/* --- Skipped Fields Placeholders --- */}
                <div className="pt-4 border-t mt-4">
                    <p className="text-sm font-medium text-gray-500 mb-2">Configuration To Be Added Later:</p>
                    <ul className="list-disc list-inside text-sm text-gray-500 space-y-1">
                        <li>Install Command Line</li>
                        <li>Uninstall Command Line</li>
                        <li>Detection Rules</li>
                        <li>Requirement Rules</li>
                    </ul>
                </div>
                 {/* --- End Skipped Fields --- */}

              </form>
            ) : (
              <p className="text-gray-500 italic">Select an app from the left menu to configure.</p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end items-center p-4 border-t space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            // TODO: Implement final save/deploy logic trigger here later
            onClick={onClose} // Simple close for now
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Confirm Configuration (Placeholder)
          </button>
        </div>

      </div>
    </div>
  );
};

export default DeploymentConfigModal;
