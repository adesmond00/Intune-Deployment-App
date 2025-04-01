import React from 'react';

const DashboardPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h2>
      <div className="bg-white rounded-lg shadow-sm p-6">
        <p className="text-gray-600">
          Welcome to the Intune Deployment Toolkit Dashboard.
        </p>
        {/* Add dashboard widgets or content here later */}
      </div>
    </div>
  );
};

export default DashboardPage;
