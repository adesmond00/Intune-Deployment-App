import React from 'react';

const DashboardPage: React.FC = () => {
  return (
    // Add dark mode text color to the outer container if needed (main already has it)
    <div className="max-w-4xl mx-auto">
      {/* Add dark mode text color */}
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Dashboard</h2>
      {/* Add dark mode background and text color */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <p className="text-gray-600 dark:text-gray-300">
          Welcome to the Intune Deployment Toolkit Dashboard.
        </p>
        {/* Add dashboard widgets or content here later */}
      </div>
    </div>
  );
};

export default DashboardPage;
