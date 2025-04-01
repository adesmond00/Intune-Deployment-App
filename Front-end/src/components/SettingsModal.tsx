/**
 * SettingsModal Component
 *
 * Displays application settings, currently including a dark mode toggle.
 */
import React from 'react';
import { useTheme } from '../context/ThemeContext'; // Import the custom hook

/**
 * Props for the SettingsModal component.
 */
interface SettingsModalProps {
  isOpen: boolean; // Controls modal visibility
  onClose: () => void; // Function to close the modal
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { theme, toggleTheme } = useTheme(); // Consume the theme context

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

          {/* Add other settings here later */}

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
