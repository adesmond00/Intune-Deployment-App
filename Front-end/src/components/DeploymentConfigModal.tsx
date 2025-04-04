/**
 * DeploymentConfigModal Component
 *
 * Provides a modal dialog interface for configuring deployment parameters
 * for applications staged from the Winget search results.
 * Features a side menu listing staged apps and a main area for configuring the selected app,
 * including a PowerShell detection script editor.
 */
import React, { useState, useEffect, useCallback } from 'react';
// Import the interface from the page component
// TODO: Consider moving shared interfaces to a dedicated types file (e.g., src/types.ts)
import { StagedAppDeploymentInfo } from '../pages/WingetAppPage';

// Import CodeMirror 5 components and styles
import { Controlled as CodeMirror } from 'react-codemirror2';
import { v4 as uuidv4 } from 'uuid';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material.css'; // Or choose another theme
import 'codemirror/mode/powershell/powershell'; // Import PowerShell mode

// Define types for rules (matching Graph API structure)
interface Win32LobAppRule {
  '@odata.type': string;
  [key: string]: any; // Allow other properties
}

// Removed unused PowerShellDetectionRule interface

interface RequirementRule extends Win32LobAppRule {
  '@odata.type': '#microsoft.graph.win32LobAppRequirement';
  operator: 'greaterOrEqual' | 'equal' | 'lessOrEqual' | 'less' | 'greater' | 'notEqual'; // Example operators
  detectionType: 'version' | 'architecture' | 'diskSpace' | 'ram'; // Example types
  value: string;
}


/**
 * Props for the DeploymentConfigModal component.
 */
interface DeploymentConfigModalProps {
  isOpen: boolean; // Controls whether the modal is visible
  onClose: () => void; // Function to call when closing the modal
  appsToConfigure: StagedAppDeploymentInfo[]; // Array of apps to configure
  onUpdateApp: (index: number, updatedApp: StagedAppDeploymentInfo) => void; // Callback to update app data in parent state
  onToggleLock: (index: number) => void; // Callback to toggle the lock state in parent
}

const DeploymentConfigModal: React.FC<DeploymentConfigModalProps> = ({
  isOpen,
  onClose,
  appsToConfigure,
  onUpdateApp,
  onToggleLock, // Destructure the new prop
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);
  const [detectionScript, setDetectionScript] = useState<string>('');
  const [runAs32Bit, setRunAs32Bit] = useState<boolean>(true); // Default to 32-bit as requested
  const [requirementRules, setRequirementRules] = useState<RequirementRule[]>([]);

  // Get the lock status of the currently selected app
  const isCurrentAppLocked = appsToConfigure[selectedIndex]?.isLocked ?? false;

  // Default Requirement Rules
  const defaultRequirementRules: RequirementRule[] = [
    {
      '@odata.type': '#microsoft.graph.win32LobAppRequirement',
      operator: 'greaterOrEqual',
      detectionType: 'version',
      value: '10.0.10240', // Windows 10 RTM
    },
    {
      '@odata.type': '#microsoft.graph.win32LobAppRequirement',
      operator: 'equal',
      detectionType: 'architecture',
      value: 'x64', // Default to x64 as requested
    },
  ];

  // Initialize/Reset local state when modal opens or selected app changes
  useEffect(() => {
    if (isOpen && appsToConfigure.length > 0) {
      // Reset local state for the newly selected/displayed app
      // Initialize with defaults, as these are being configured here
      setDetectionScript(''); // Start with empty script
      setRunAs32Bit(true); // Default to 32-bit
      setRequirementRules(defaultRequirementRules); // Start with default requirements
      setShowAdvancedSettings(false); // Reset advanced view
    } else if (!isOpen) {
       // Reset state completely when modal closes
       setDetectionScript('');
       setRunAs32Bit(true);
       setRequirementRules([]);
       setShowAdvancedSettings(false);
    }
  }, [isOpen, selectedIndex, appsToConfigure]); // Rerun when modal opens or selection changes

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex((prevIndex) =>
        prevIndex >= appsToConfigure.length ? Math.max(0, appsToConfigure.length - 1) : prevIndex
      );
      if (appsToConfigure.length > 0 && selectedIndex >= appsToConfigure.length) {
         setSelectedIndex(0);
      }
    }
    // Removed dependency on appsToConfigure.length as it's covered by appsToConfigure
  }, [isOpen, appsToConfigure]);

  // Handler for CodeMirror changes
  const handleScriptChange = useCallback((_: any, __: any, value: string) => { // Use underscores for unused params
    setDetectionScript(value);
    // TODO: Propagate this change back if needed, but likely only on final submit
  }, []);


  if (!isOpen) {
    return null;
  }

  const currentApp = appsToConfigure.length > 0 ? appsToConfigure[selectedIndex] : null;

  // Removed hardcoded showCommandLines flag

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
            className="text-gray-400 bg-transparent hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white rounded-lg text-sm p-1.5 ml-auto inline-flex items-center pl-4" // Added padding left
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
                    disabled={isCurrentAppLocked} // Disable if locked
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:bg-gray-200 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
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
                    disabled={isCurrentAppLocked} // Disable if locked
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:bg-gray-200 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
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
                    disabled={isCurrentAppLocked} // Disable if locked
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:bg-gray-200 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
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
                     disabled={isCurrentAppLocked} // Disable if locked
                     className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:bg-gray-200 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
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
                     disabled={isCurrentAppLocked} // Disable if locked
                     className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:bg-gray-200 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
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

                 {/* --- Advanced Settings Toggle --- */}
                 <div className="flex items-center justify-end mt-4 space-x-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Show Advanced</span>
                    <button
                      type="button" // Prevent form submission
                      onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 duration-300 ease-in-out ${showAdvancedSettings ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                      aria-checked={showAdvancedSettings}
                      role="switch"
                      disabled={isCurrentAppLocked} // Disable if locked
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${showAdvancedSettings ? 'translate-x-5' : ''}`}
                      ></div>
                    </button>
                 </div>

                 {/* --- PowerShell Detection Script --- */}
                 <div className="pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
                    <label htmlFor={`detectionScript-${currentApp.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        PowerShell Detection Script
                    </label>
                    {/* Fixed CodeMirror implementation to ensure only one instance is rendered */}
                    <div className="border border-gray-300 dark:border-gray-600 rounded overflow-hidden" style={{ minHeight: "150px" }}>
                      <CodeMirror
                        value={detectionScript}
                        options={{
                          mode: 'powershell',
                          theme: 'material',
                          lineNumbers: true,
                          readOnly: isCurrentAppLocked,
                          viewportMargin: Infinity, // Helps with proper sizing
                          lineWrapping: true,
                        }}
                        onBeforeChange={handleScriptChange}
                        editorDidMount={(editor) => {
                          // Force a refresh to ensure proper rendering
                          setTimeout(() => editor.refresh(), 50);
                        }}
                      />
                    </div>
                    {/* 32/64-bit Toggle - Conditionally Visible */}
                    {showAdvancedSettings && (
                        <div className="flex items-center justify-start mt-2 space-x-2 group">
                            <button
                              type="button"
                              onClick={() => setRunAs32Bit(!runAs32Bit)}
                              className={`w-11 h-6 flex items-center rounded-full p-1 duration-300 ease-in-out ${runAs32Bit ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                              aria-checked={runAs32Bit}
                              role="switch"
                              disabled={isCurrentAppLocked}
                            >
                              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${runAs32Bit ? 'translate-x-5' : ''}`}></div>
                            </button>
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                Run script as {runAs32Bit ? '32-bit' : '64-bit'} process on 64-bit systems
                            </span>
                            {/* Info Tooltip */}
                            <div className="relative flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 dark:text-gray-500 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-black text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                                    Determines if the PowerShell detection script should run in a 32-bit or 64-bit process on 64-bit systems. Default is 32-bit.
                                </div>
                            </div>
                        </div>
                    )}
                 </div>
                 {/* --- End PowerShell Detection Script --- */}


                 {/* Conditionally Render Advanced Settings (Command Lines & Requirement Rules) */}
                 {showAdvancedSettings && (
                    <div className="mt-4 p-4 border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 space-y-4">
                      <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">Advanced Configuration</h5>

                      {/* Command Lines - Now Editable */}
                      <div>
                        <h6 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">Command Lines</h6>
                        <div className="space-y-2">
                            <div>
                                <label htmlFor={`installCommandLine-${currentApp.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Install Command Line</label>
                                <textarea
                                  id={`installCommandLine-${currentApp.id}`}
                                  rows={2}
                                  value={currentApp.installCommandLine || ''}
                                  onChange={(e) => handleInputChange('installCommandLine', e.target.value)} // Assuming installCommandLine is added to StagedAppDeploymentInfo
                                  disabled={isCurrentAppLocked} // Disable if locked
                                  className="w-full p-2 border border-gray-300 dark:border-gray-500 rounded shadow-sm bg-white dark:bg-gray-600 font-mono text-xs text-gray-900 dark:text-gray-100 disabled:bg-gray-200 dark:disabled:bg-gray-500 disabled:cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label htmlFor={`uninstallCommandLine-${currentApp.id}`} className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Uninstall Command Line</label>
                                <textarea
                                  id={`uninstallCommandLine-${currentApp.id}`}
                                  rows={2}
                                  value={currentApp.uninstallCommandLine || ''}
                                  onChange={(e) => handleInputChange('uninstallCommandLine', e.target.value)} // Assuming uninstallCommandLine is added to StagedAppDeploymentInfo
                                  disabled={isCurrentAppLocked} // Disable if locked
                                  className="w-full p-2 border border-gray-300 dark:border-gray-500 rounded shadow-sm bg-white dark:bg-gray-600 font-mono text-xs text-gray-900 dark:text-gray-100 disabled:bg-gray-200 dark:disabled:bg-gray-500 disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>
                      </div>

                      {/* Requirement Rules - Editable UI */}
                      <div className="pt-4 border-t border-gray-300 dark:border-gray-500">
                         <h6 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">Requirement Rules</h6>
                         <div className="space-y-4">
                            {requirementRules.map((rule, index) => (
                              <div key={index} className="p-3 bg-white dark:bg-gray-600 rounded border border-gray-300 dark:border-gray-500">
                                <div className="grid grid-cols-3 gap-3">
                                  {/* Detection Type */}
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                                      Detection Type
                                    </label>
                                    <select
                                      value={rule.detectionType}
                                      onChange={(e) => {
                                        const newRules = [...requirementRules];
                                        newRules[index] = {
                                          ...newRules[index],
                                          detectionType: e.target.value as 'version' | 'architecture' | 'diskSpace' | 'ram'
                                        };
                                        setRequirementRules(newRules);
                                      }}
                                      disabled={isCurrentAppLocked}
                                      className="w-full p-1 text-xs border border-gray-300 dark:border-gray-500 rounded shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:bg-gray-200 dark:disabled:bg-gray-600"
                                    >
                                      <option value="version">Version</option>
                                      <option value="architecture">Architecture</option>
                                      <option value="diskSpace">Disk Space</option>
                                      <option value="ram">RAM</option>
                                    </select>
                                  </div>
                                  
                                  {/* Operator */}
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                                      Operator
                                    </label>
                                    <select
                                      value={rule.operator}
                                      onChange={(e) => {
                                        const newRules = [...requirementRules];
                                        newRules[index] = {
                                          ...newRules[index],
                                          operator: e.target.value as 'greaterOrEqual' | 'equal' | 'lessOrEqual' | 'less' | 'greater' | 'notEqual'
                                        };
                                        setRequirementRules(newRules);
                                      }}
                                      disabled={isCurrentAppLocked}
                                      className="w-full p-1 text-xs border border-gray-300 dark:border-gray-500 rounded shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:bg-gray-200 dark:disabled:bg-gray-600"
                                    >
                                      <option value="equal">Equal (=)</option>
                                      <option value="notEqual">Not Equal (!=)</option>
                                      <option value="greaterOrEqual">Greater or Equal (&gt;=)</option>
                                      <option value="greater">Greater Than (&gt;)</option>
                                      <option value="lessOrEqual">Less or Equal (&lt;=)</option>
                                      <option value="less">Less Than (&lt;)</option>
                                    </select>
                                  </div>
                                  
                                  {/* Value */}
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                                      Value
                                    </label>
                                    {rule.detectionType === 'architecture' ? (
                                      <select
                                        value={rule.value}
                                        onChange={(e) => {
                                          const newRules = [...requirementRules];
                                          newRules[index] = {
                                            ...newRules[index],
                                            value: e.target.value
                                          };
                                          setRequirementRules(newRules);
                                        }}
                                        disabled={isCurrentAppLocked}
                                        className="w-full p-1 text-xs border border-gray-300 dark:border-gray-500 rounded shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:bg-gray-200 dark:disabled:bg-gray-600"
                                      >
                                        <option value="x64">x64 (64-bit)</option>
                                        <option value="x86">x86 (32-bit)</option>
                                        <option value="arm">ARM</option>
                                        <option value="arm64">ARM64</option>
                                      </select>
                                    ) : (
                                      <input
                                        type="text"
                                        value={rule.value}
                                        onChange={(e) => {
                                          const newRules = [...requirementRules];
                                          newRules[index] = {
                                            ...newRules[index],
                                            value: e.target.value
                                          };
                                          setRequirementRules(newRules);
                                        }}
                                        disabled={isCurrentAppLocked}
                                        placeholder={rule.detectionType === 'version' ? '10.0.10240' : 
                                                    rule.detectionType === 'diskSpace' ? '1024 (MB)' : 
                                                    rule.detectionType === 'ram' ? '2048 (MB)' : ''}
                                        className="w-full p-1 text-xs border border-gray-300 dark:border-gray-500 rounded shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:bg-gray-200 dark:disabled:bg-gray-600"
                                      />
                                    )}
                                  </div>
                                </div>
                                
                                {/* Remove Rule Button */}
                                {requirementRules.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newRules = requirementRules.filter((_, i) => i !== index);
                                      setRequirementRules(newRules);
                                    }}
                                    disabled={isCurrentAppLocked}
                                    className="mt-2 px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:text-gray-400 dark:disabled:text-gray-500"
                                  >
                                    Remove Rule
                                  </button>
                                )}
                              </div>
                            ))}
                            
                            {/* Add Rule Button */}
                            <button
                              type="button"
                              onClick={() => {
                                const newRule: RequirementRule = {
                                  '@odata.type': '#microsoft.graph.win32LobAppRequirement',
                                  operator: 'equal',
                                  detectionType: 'version',
                                  value: '10.0.10240',
                                };
                                setRequirementRules([...requirementRules, newRule]);
                              }}
                              disabled={isCurrentAppLocked}
                              className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 dark:disabled:bg-gray-600"
                            >
                              Add Requirement Rule
                            </button>
                         </div>
                      </div>

                    </div>
                 )}

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
          {/* Lock/Unlock Button */}
          <button
            onClick={() => onToggleLock(selectedIndex)}
            disabled={!currentApp} // Disable if no app is selected
            className={`px-4 py-2 text-white rounded transition-colors duration-150 ease-in-out
              ${isCurrentAppLocked
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' // Red for Unlock
                : 'bg-green-600 hover:bg-green-700 focus:ring-green-500' // Green for Lock
              }
              focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800
              disabled:bg-gray-400 disabled:cursor-not-allowed`}
          >
            {isCurrentAppLocked ? 'Unlock Configuration' : 'Lock Configuration'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default DeploymentConfigModal;
