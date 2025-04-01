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
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex((prevIndex) =>
        prevIndex >= appsToConfigure.length ? Math.max(0, appsToConfigure.length - 1) : prevIndex
      );
      if (appsToConfigure.length > 0 && selectedIndex >= appsToConfigure.length) {
         setSelectedIndex(0);
      }
    }
  }, [isOpen, appsToConfigure.length]);

  if (!isOpen) {
    return null;
  }

  const currentApp = appsToConfigure.length > 0 ? appsToConfigure[selectedIndex] : null;

  // Controls visibility of command line fields in the UI. Set to true for debugging/future use.
  // WARNING: Do not commit with this set to true unless intended.
  const showCommandLines = false;

  const handleInputChange = (
    field: keyof StagedAppDeploymentInfo,
    value: string | 'system' | 'user' | 'suppress' | 'force'
  ) => {
    if (!currentApp) return;
    const updatedApp = { ...currentApp, [field]: value };
    onUpdateApp(selectedIndex, updatedApp);
  };

  return (
    // Modal backdrop
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
      {/* Modal Content - Added dark mode background */}
      <div className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col" style={{ maxHeight: '90vh' }}>

        {/* Modal Header - Added dark mode border, text */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Configure App Deployments ({appsToConfigure.length} apps)
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 bg-transparent hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white rounded-lg text-sm p-1.5 ml-auto inline-flex items-center"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
          </button>
        </div>

        {/* Modal Body (Two Panes) */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left Pane: Side Menu - Added dark mode background, border, text */}
          <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-4 space-y-2 bg-gray-50 dark:bg-gray-900">
            <h4 className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100">Staged Apps</h4>
            {appsToConfigure.map((app, index) => (
              <button
                key={app.id}
                onClick={() => setSelectedIndex(index)}
                // Added dark mode styles for side menu items
                className={`w-full text-left p-2 rounded text-sm ${
                  selectedIndex === index
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-100 font-semibold'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {app.displayName}
              </button>
            ))}
             {appsToConfigure.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 italic">No apps staged.</p>}
          </div>

          {/* Right Pane: Configuration Form - Added dark mode background */}
          <div className="w-2/3 overflow-y-auto p-6 bg-white dark:bg-gray-800">
            {currentApp ? (
              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                 {/* Added dark mode text color */}
                <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">{currentApp.displayName} - Configuration</h4>

                {/* Display Name */}
                <div>
                   {/* Added dark mode text color */}
                  <label htmlFor={`displayName-${currentApp.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name</label>
                   {/* Added dark mode styles */}
                  <input
                    type="text"
                    id={`displayName-${currentApp.id}`}
                    value={currentApp.displayName}
                    onChange={(e) => handleInputChange('displayName', e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Description */}
                <div>
                   {/* Added dark mode text color */}
                  <label htmlFor={`description-${currentApp.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                   {/* Added dark mode styles */}
                  <textarea
                    id={`description-${currentApp.id}`}
                    rows={3}
                    value={currentApp.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Enter application description..."
                  />
                </div>

                {/* Publisher */}
                <div>
                   {/* Added dark mode text color */}
                  <label htmlFor={`publisher-${currentApp.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Publisher</label>
                   {/* Added dark mode styles */}
                  <input
                    type="text"
                    id={`publisher-${currentApp.id}`}
                    value={currentApp.publisher || ''}
                    onChange={(e) => handleInputChange('publisher', e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Enter publisher name..."
                  />
                </div>

                {/* Install Experience */}
                <div>
                    {/* Added dark mode text color */}
                   <label htmlFor={`installExperience-${currentApp.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Install Experience</label>
                    {/* Added dark mode styles */}
                   <select
                     id={`installExperience-${currentApp.id}`}
                     value={currentApp.installExperience}
                     onChange={(e) => handleInputChange('installExperience', e.target.value as 'system' | 'user')}
                     className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                   >
                     <option value="system">System</option>
                     <option value="user">User</option>
                   </select>
                </div>

                {/* Restart Behavior */}
                 <div>
                    {/* Added dark mode text color */}
                   <label htmlFor={`restartBehavior-${currentApp.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Restart Behavior</label>
                    {/* Added dark mode styles */}
                   <select
                     id={`restartBehavior-${currentApp.id}`}
                     value={currentApp.restartBehavior}
                     onChange={(e) => handleInputChange('restartBehavior', e.target.value as 'suppress' | 'force')}
                     className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                   >
                     <option value="suppress">Suppress</option>
                     <option value="force">Force</option>
                   </select>
                 </div>

                 {/* --- Read Only Info - Added dark mode text color --- */}
                 <div className="pt-4 text-gray-700 dark:text-gray-300">
                    <p className="text-sm"><span className="font-semibold">Winget ID:</span> {currentApp.id}</p>
                    <p className="text-sm"><span className="font-semibold">Version:</span> {currentApp.version}</p>
                 </div>

                 {/* Conditionally Render Command Lines */}
                 {showCommandLines && (
                    <>
                      <div>
                        <label htmlFor={`installCommandLine-${currentApp.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Install Command Line</label>
                        <textarea
                          readOnly
                          id={`installCommandLine-${currentApp.id}`}
                          rows={2}
                          value={currentApp.installCommandLine || ''}
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded shadow-sm bg-gray-100 dark:bg-gray-700 font-mono text-xs text-gray-700 dark:text-gray-300"
                        />
                      </div>
                      <div>
                        <label htmlFor={`uninstallCommandLine-${currentApp.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Uninstall Command Line</label>
                        <textarea
                          readOnly
                          id={`uninstallCommandLine-${currentApp.id}`}
                          rows={2}
                          value={currentApp.uninstallCommandLine || ''}
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded shadow-sm bg-gray-100 dark:bg-gray-700 font-mono text-xs text-gray-700 dark:text-gray-300"
                        />
                      </div>
                    </>
                 )}

                {/* --- Skipped Fields Placeholders - Added dark mode text color --- */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Configuration To Be Added Later:</p>
                    <ul className="list-disc list-inside text-sm text-gray-500 dark:text-gray-400 space-y-1">
                        <li>Detection Rules (Structured Input)</li>
                        <li>Requirement Rules (Structured Input)</li>
                    </ul>
                </div>
                 {/* --- End Skipped Fields --- */}

              </form>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 italic">Select an app from the left menu to configure.</p>
            )}
          </div>
        </div>

        {/* Modal Footer - Added dark mode border, button styles */}
        <div className="flex justify-end items-center p-4 border-t border-gray-200 dark:border-gray-700 space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={onClose} // Simple close for now
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
          >
            Confirm Configuration (Placeholder)
          </button>
        </div>

      </div>
    </div>
  );
};

export default DeploymentConfigModal;
