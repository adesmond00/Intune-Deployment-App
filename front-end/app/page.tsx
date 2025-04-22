/**
 * Home page component for the Intune Deployment App
 *
 * This is the main entry point for the application that users see when they
 * visit the root URL. It handles both Electron and browser environments,
 * showing a login screen when needed in Electron.
 */
"use client"

import React, { useState, useEffect } from "react"
import Dashboard from "@/components/dashboard"
import { DashboardLayout } from "@/components/dashboard-layout"
import { LoginScreen } from "@/components/login-screen"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

/**
 * Home page component that handles Electron integration and authentication flow
 *
 * @returns The login screen or dashboard based on authentication state
 */
export default function Home() {
  const [showLogin, setShowLogin] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [isElectron, setIsElectron] = useState(false)

  useEffect(() => {
    // Check if we're running in Electron
    const electron = window.electronAPI;
    setIsElectron(!!electron);
    
    if (electron) {
      // Setup Electron event listeners
      electron.onShowLogin(() => {
        setShowLogin(true);
      });
      
      electron.onApiReady(() => {
        setShowLogin(false);
        setApiError(null);
      });
      
      electron.onApiError((message) => {
        setApiError(message);
      });
      
      // Clean up listeners on component unmount
      return () => {
        electron.removeAllListeners('show-login');
        electron.removeAllListeners('api-ready');
        electron.removeAllListeners('api-error');
      };
    }
  }, []);

  // In browser mode, always show dashboard
  // In Electron mode, show login if needed
  if (isElectron && showLogin) {
    return <LoginScreen />;
  }

  return (
    <DashboardLayout>
      {apiError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>API Error</AlertTitle>
          <AlertDescription>{apiError}</AlertDescription>
        </Alert>
      )}
      <Dashboard />
    </DashboardLayout>
  )
}
