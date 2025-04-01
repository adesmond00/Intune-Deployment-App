/**
 * SettingsModal Component
 *
 * Displays application settings, including dark mode and tenant connection options.
 */
import React, { useState } from 'react'; // Add useState
import { useTheme } from '../context/ThemeContext'; // Import the custom hook
import { useTenant } from '../context/TenantContext'; // Import the tenant hook
import { debugMode } from '../config'; // Import the debug flag
import TenantConnectionModal from './TenantConnectionModal'; // Import the connection modal

/**
 * Props for the SettingsModal component.
 */
interface SettingsModalProps {
  isOpen: boolean; // Controls modal visibility
  onClose: () => void; // Function to close the modal
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { theme, toggleTheme } = useTheme(); // Consume the theme context
  const { isConnected, disconnect, mockConnect, mockDisconnect, tenantId } = useTenant(); // Consume tenant context
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false); // State for connection modal

  const openConnectionModal = () => setIsConnectionModalOpen(true);
  const closeConnectionModal = () => setIsConnectionModalOpen(false);

  // Handle mock toggle change
  const handleMockToggle = () => {
    if (isConnected && tenantId === 'mock-tenant-id') {
      mockDisconnect();
    } else if (!isConnected) { // Only allow mock connect if not already connected (real or mock)
      mockConnect('Mock Tenant');
    }
    // Do nothing if trying to toggle mock while a real connection exists
  };


  if (!isOpen) {
    return null; // Don't render if not open
  }

  // Simple toggle switch styling (can be enhanced)
  const switchBaseClasses = "w-14 h-8 flex items-center bg-gray-300 rounded-full p-1 duration-300 ease-in-out";
  const switchCheckedClasses = "bg-green-400";
  const switchKnobBaseClasses = "bg-white w-6 h-6 rounded-full shadow-md transform duration-300 ease-in-out";
  const switchKnobCheckedClasses = "translate-x-6";

  return (
    <>
      {/* Modal Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" aria-hidden="true" onClick={onClose}></div>

      {/* Modal Content */}
      <div className="fixed z-50 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Settings</h4>
          <button
            onClick={onClose}
            className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 dark:hover:text-white rounded-lg p-1.5"
            aria-label="Close settings"
          >
             <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
          </button>
        </div>

        {/* Settings Content */}
        <div className="space-y-4">
          {/* Dark Mode Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">Dark Mode</span>
            <button
              onClick={toggleTheme}
              className={`${switchBaseClasses} ${theme === 'dark' ? switchCheckedClasses : ''}`}
              aria-checked={theme === 'dark'}
              role="switch"
            >
              <div
                className={`${switchKnobBaseClasses} ${theme === 'dark' ? switchKnobCheckedClasses : ''}`}
              ></div>
            </button>
          </div>

          {/* Divider */}
          <hr className="border-gray-200 dark:border-gray-700" />

          {/* Tenant Connection Section */}
          <div>
            <h5 className="text-md font-semibold mb-2 text-gray-800 dark:text-gray-200">Tenant Connection</h5>
            {isConnected ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Connected as: {tenantId === 'mock-tenant-id' ? 'Mock Tenant' : tenantId}
                </span>
                <button
                  onClick={disconnect}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={openConnectionModal}
                className="w-full px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
              >
                Connect to Tenant
              </button>
            )}
          </div>

          {/* Debug Mode Section (Conditional) */}
          {debugMode && (
            <>
              <hr className="border-gray-200 dark:border-gray-700" />
              <div>
                 <h5 className="text-md font-semibold mb-2 text-gray-800 dark:text-gray-200">Debugging</h5>
                 <div className="flex items-center justify-between">
                    <span className="text-gray-700 dark:text-gray-300">Toggle Mock Connection</span>
                    <button
                      onClick={handleMockToggle}
                      className={`${switchBaseClasses} ${isConnected && tenantId === 'mock-tenant-id' ? switchCheckedClasses : ''} ${isConnected && tenantId !== 'mock-tenant-id' ? 'opacity-50 cursor-not-allowed' : ''}`} // Dim if real connection exists
                      aria-checked={isConnected && tenantId === 'mock-tenant-id'}
                      role="switch"
                      disabled={isConnected && tenantId !== 'mock-tenant-id'} // Disable if real connection exists
                    >
                      <div
                        className={`${switchKnobBaseClasses} ${isConnected && tenantId === 'mock-tenant-id' ? switchKnobCheckedClasses : ''}`}
                      ></div>
                    </button>
                 </div>
              </div>
            </>
          )}

        </div>

         {/* Modal Footer (Optional, can just use close button in header) */}
         {/* <div className="mt-6 flex justify-end">
           <button
             onClick={onClose}
             className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
           >
             Close
           </button>
         </div> */}
      </div>

      {/* Render the Tenant Connection Modal */}
      <TenantConnectionModal
        isOpen={isConnectionModalOpen}
        onClose={closeConnectionModal}
      />
    </>
  );
};

export default SettingsModal;
