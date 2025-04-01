import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom'; // Import routing components
import { ThemeProvider } from './context/ThemeContext'; // Import ThemeProvider
import { Sidebar } from './components/Sidebar';
// Placeholder imports for page components
import DashboardPage from './pages/DashboardPage';
import ApplicationsPage from './pages/ApplicationsPage.tsx'; // Explicitly add .tsx extension
import WingetAppPage from './pages/WingetAppPage'; // Import the new Winget page component
import SettingsModal from './components/SettingsModal'; // Import the SettingsModal component

interface HeaderProps {
  toggleSidebar: () => void;
}

const Header = ({ toggleSidebar }: HeaderProps) => {
  return (
    // Add dark mode classes for header background, border, text
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 h-16 flex items-center px-6 sticky top-0 z-10">
      <button
        onClick={toggleSidebar}
        className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        aria-label="Toggle sidebar"
      >
        <svg
          className="w-6 h-6" // Removed color class, rely on parent or stroke
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>
      <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 ml-4">Intune Deployment Toolkit</h1>
    </header>
  )
}

// Removed SidebarProps interface and Sidebar component definition

function AppContent() { // Renamed original App content to AppContent
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // State to control the Settings modal visibility
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);


  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Function to open the settings modal (will be passed to Sidebar)
  const openSettingsModal = () => {
    setIsSettingsModalOpen(true);
  };

  // Function to close the settings modal (will be passed to SettingsModal)
   const closeSettingsModal = () => {
    setIsSettingsModalOpen(false);
  };


  return (
    // Apply dark mode classes to the main container
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden">
      {/* Pass openSettingsModal function to Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onSettingsClick={openSettingsModal} />
      {/* Add transition and conditional margin to main content area */}
      <div className={`
        flex-1 flex flex-col transition-all duration-300 ease-in-out
        ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-0'}
      `}>
        {/* Apply dark mode classes to Header and main */}
        <Header toggleSidebar={toggleSidebar} />
        <main className="flex-1 p-6 overflow-auto bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          {/* Define routes */}
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/applications" element={<ApplicationsPage />} />
            {/* Route for the Winget application search and staging page */}
            <Route path="/applications/winget" element={<WingetAppPage />} />
            {/* Add other routes here as needed */}
          </Routes>
        </main>
      </div>

      {/* Render SettingsModal conditionally */}
      <SettingsModal isOpen={isSettingsModalOpen} onClose={closeSettingsModal} />

    </div>
  );
}

// New top-level App component that includes the ThemeProvider
function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}


export default App;
