import React, { useState } from 'react';
import { useTenant } from '../context/TenantContext';

interface TenantConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TenantConnectionModal: React.FC<TenantConnectionModalProps> = ({ isOpen, onClose }) => {
  const [clientId, setClientId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const { connect } = useTenant();

  const handleConnect = () => {
    if (clientId.trim() && tenantId.trim()) {
      connect(clientId.trim(), tenantId.trim());
      onClose(); // Close modal after attempting connection
      // Reset fields for next time
      setClientId('');
      setTenantId('');
    } else {
      // Basic validation feedback (could be improved)
      alert('Please enter both Client ID and Tenant ID.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-60 flex justify-center items-center p-4"> {/* Increased z-index */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Connect to Tenant</h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Client ID (App ID)
            </label>
            <input
              type="text"
              id="clientId"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100"
              placeholder="Enter Client ID"
            />
          </div>
          <div>
            <label htmlFor="tenantId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tenant ID
            </label>
            <input
              type="text"
              id="tenantId"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100"
              placeholder="Enter Tenant ID"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleConnect}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
          >
            Connect
          </button>
        </div>
      </div>
    </div>
  );
};

export default TenantConnectionModal;
