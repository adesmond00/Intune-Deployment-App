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

// Define enhanced ElectronAPI interface that includes isElectron flag
interface ElectronAPI {
  isElectron: boolean;
  login: (credentials: { clientId: string; clientSecret: string; tenantId: string }) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<{ success: boolean }>;
  onApiReady: (callback: (port: number) => void) => void;
  onApiError: (callback: (message: string) => void) => void;
  onShowLogin: (callback: () => void) => void;
  onApiLog: (callback: (message: string) => void) => void;
  removeAllListeners: (channel: string) => void;
  getStoreValue: (key: string) => Promise<any>;
}

// Extend Window interface to include our custom electronAPI property
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

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
    // Check if we're running in Electron - use explicit isElectron flag if available
    const electron = window.electronAPI;
    const electronDetected = !!electron && (electron.isElectron === true);
    
    console.log("App initializing, checking for Electron:", {
      electronObjectExists: !!electron,
      isElectronFlag: electron?.isElectron,
      electronDetected
    });
    
    setIsElectron(electronDetected);
    
    if (electronDetected) {
      console.log("Electron environment detected, setting up event listeners");
      
      // Setup Electron event listeners
      if (window.electronAPI) {
        window.electronAPI.onShowLogin(() => {
          console.log("Received show-login event, showing login screen");
          console.log("Renderer received show-login event");
          setShowLogin(true);
          setLoading(false);
        });
      }
      
      if (window.electronAPI) {
        window.electronAPI.onApiReady((port) => {
          console.log("Received api-ready event with port:", port);
          setShowLogin(false);
          setApiError(null);
          setLoading(false);
        });
      }
      
      if (window.electronAPI) {
        window.electronAPI.onApiError((message) => {
          console.error("Received api-error event:", message);
          setApiError(message);
          setLoading(false);
        });
      }
      
      if (window.electronAPI) {
        window.electronAPI.getStoreValue('isLoggedIn')
          .then((isLoggedIn: boolean | undefined) => {
            console.log(`Renderer received isLoggedIn: ${isLoggedIn}`);
            if (isLoggedIn) {
              console.log('Setting state: loading=false, showLogin=false');
              setLoading(false);
              setShowLogin(false);
            } else {
              console.log('Setting state: loading=false, showLogin=true');
              setLoading(false);
              setShowLogin(true);
            }
          });
      }
      
      // Clean up listeners on component unmount
      return () => {
        console.log("Cleaning up Electron event listeners");
        if (window.electronAPI) {
          window.electronAPI.removeAllListeners('show-login');
          window.electronAPI.removeAllListeners('api-ready');
          window.electronAPI.removeAllListeners('api-error');
        }
      };
    } else {
      // In browser mode, just show the dashboard
      console.log("Browser environment detected, skipping Electron initialization");
      setLoading(false);
    }
  }, []);

  console.log("Render state:", { isElectron, showLogin, loading, apiError });

  // Special case: if in Electron and login should be shown, override loading state
  useEffect(() => {
    if (isElectron && showLogin) {
      console.log("Login screen should be shown, ending loading state");
      setLoading(false);
    }
  }, [isElectron, showLogin]);

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

  // In Electron mode, show login if needed
  if (isElectron && showLogin) {
    console.log("Rendering login screen");
    return <LoginScreen onLoginSuccess={() => {
      console.log("Login successful, updating state");
      setLoading(false);
      setShowLogin(false);
      setApiError(null);
    }} />;
  }

  // Default: show dashboard
  console.log("Rendering dashboard");
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
