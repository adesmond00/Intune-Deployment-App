import React from 'react';
import { Link } from 'react-router-dom'; // Import Link for navigation

const ApplicationsPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Manage Applications</h2>
      <div className="bg-white rounded-lg shadow-sm p-6">
        <p className="text-gray-600 mb-4">
          Welcome to the application management section. Choose an option below to add a new application to Intune.
        </p>
        <div className="flex space-x-4">
          {/* Link to the Winget application search page */}
          <Link
            to="/applications/winget"
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded transition-colors"
          >
            Add an App with Winget
          </Link>
          <button className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded transition-colors">
            Add an App with Scoop
          </button>
          {/* Add other options like 'Add Custom App' later */}
        </div>
      </div>
    </div>
  );
};

export default ApplicationsPage;
