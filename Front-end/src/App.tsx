import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom'; // Import routing components
import { Sidebar } from './components/Sidebar';
// Placeholder imports for page components (will be created next)
import DashboardPage from './pages/DashboardPage';
import ApplicationsPage from './pages/ApplicationsPage.tsx'; // Explicitly add .tsx extension
import WingetAppPage from './pages/WingetAppPage'; // Import the new Winget page component

interface HeaderProps {
  toggleSidebar: () => void;
}

const Header = ({ toggleSidebar }: HeaderProps) => {
  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center px-6 sticky top-0">
      <button
        onClick={toggleSidebar}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Toggle sidebar"
      >
        <svg
          className="w-6 h-6 text-gray-600"
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
      <h1 className="text-xl font-semibold text-gray-800 ml-4">Intune Deployment Toolkit</h1>
    </header>
  )
}

// Removed SidebarProps interface and Sidebar component definition

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden"> {/* Use h-screen and overflow-hidden */}
      <Sidebar isOpen={isSidebarOpen} />
      {/* Add transition and conditional margin to main content area */}
      <div className={`
        flex-1 flex flex-col transition-all duration-300 ease-in-out
        ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-0'}
      `}>
        <Header toggleSidebar={toggleSidebar} />
        <main className="flex-1 p-6 overflow-auto"> {/* Ensure main content scrolls */}
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
    </div>
  )
}

export default App
