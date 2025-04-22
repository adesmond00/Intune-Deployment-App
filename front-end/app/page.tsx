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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if we're running in Electron
    const electron = window.electronAPI;
    setIsElectron(!!electron);
    
    console.log("App initializing, checking for Electron:", !!electron);
    
    if (electron) {
      console.log("Setting up Electron event listeners");
      
      // Setup Electron event listeners
      electron.onShowLogin(() => {
        console.log("Received show-login event");
        setShowLogin(true);
        setLoading(false);
      });
      
      electron.onApiReady(() => {
        console.log("Received api-ready event");
        setShowLogin(false);
        setApiError(null);
        setLoading(false);
      });
      
      electron.onApiError((message) => {
        console.error("Received api-error event:", message);
        setApiError(message);
        setLoading(false);
      });
      
      // Clean up listeners on component unmount
      return () => {
        console.log("Cleaning up Electron event listeners");
        electron.removeAllListeners('show-login');
        electron.removeAllListeners('api-ready');
        electron.removeAllListeners('api-error');
      };
    } else {
      // In browser mode, just show the dashboard
      setLoading(false);
    }
  }, []);

  console.log("Render state:", { isElectron, showLogin, loading, apiError });

  // Show loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Initializing...</h2>
          <p className="text-muted-foreground">Starting Intune Deployment App</p>
        </div>
      </div>
    );
  }

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
