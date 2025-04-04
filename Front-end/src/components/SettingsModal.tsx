/**
 * SettingsModal Component
 *
 * Displays application settings, including dark mode and tenant connection options.
 */
import React from 'react'; // Removed useState as it's not used directly here anymore
import { useTheme } from '../context/ThemeContext'; // Import the custom hook
import { useTenant } from '../context/TenantContext'; // Import the tenant hook
import { authService } from '../services/authService'; // Import the auth service
import { debugMode } from '../config'; // Import the debug flag

/**
 * Props for the SettingsModal component.
 */
interface SettingsModalProps {
  isOpen: boolean; // Controls modal visibility
  onClose: () => void; // Function to close the modal
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { theme, toggleTheme } = useTheme(); // Consume the theme context
  // Get connection status, loading state, and mock functions from TenantContext
  const { isConnected, isLoadingStatus, mockConnect, mockDisconnect, tenantId } = useTenant();

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
                  Connected as: {tenantId === 'mock-tenant-id' ? 'Mock Tenant' : (tenantId || 'Unknown')}
                </span>
                <button
                  onClick={() => authService.logout()} // Use authService.logout
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800"
                >
                  Logout
                </button>
              </div>
            ) : isLoadingStatus ? (
              // Show loading indicator when checking status post-redirect
              <div className="flex items-center justify-center w-full px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 dark:bg-gray-700 dark:text-gray-300">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-500 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting...
              </div>
            ) : (
              // Show login button when not connected and not loading
              <button
                onClick={() => authService.login()} // Use authService.login
                className="w-full px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
              >
                Login / Connect Tenant
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
    </>
  );
};

export default SettingsModal;
