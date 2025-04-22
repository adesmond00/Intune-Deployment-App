"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

/**
 * LoginScreen component for Microsoft Graph API authentication
 * 
 * This component replaces the .env file authentication mechanism with a UI-based approach
 * for use in the Electron application. It allows users to enter their Microsoft Graph API
 * credentials securely.
 */
export function LoginScreen() {
  const [clientId, setClientId] = useState("")
  const [clientSecret, setClientSecret] = useState("")
  const [tenantId, setTenantId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isElectron, setIsElectron] = useState(false)

  // Check if we're running in Electron
  useEffect(() => {
    setIsElectron(!!window.electronAPI);
    
    // Setup listeners for Electron events
    if (window.electronAPI) {
      window.electronAPI.onShowLogin(() => {
        // Reset any state if needed when login is shown
      });
      
      // Clean up listeners on component unmount
      return () => {
        if (window.electronAPI) {
          window.electronAPI.removeAllListeners('show-login');
        }
      };
    }
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!clientId || !clientSecret || !tenantId) {
      setError("All fields are required");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      if (isElectron && window.electronAPI) {
        // Use Electron's IPC for login
        const result = await window.electronAPI.login({
          clientId,
          clientSecret,
          tenantId
        });
        
        if (!result.success) {
          throw new Error(result.message || "Login failed");
        }
        
        // Login successful - Electron main process will handle starting the API
        // and transitioning to the main application
      } else {
        // This is just a fallback for non-Electron environments (browser testing)
        // In production, this component is intended for use within Electron only
        console.warn("Login attempted outside Electron environment - this would not work in production");
        setTimeout(() => {
          // Simulate successful login for testing purposes
          window.location.href = "/";
        }, 1500);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="mx-auto max-w-md w-full">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Intune Deployment App</CardTitle>
          <CardDescription>
            Enter your Microsoft Graph API credentials to authenticate
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="clientId">Application (Client) ID</Label>
              <Input
                id="clientId"
                placeholder="Enter your Azure application client ID"
                value={clientId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClientId(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tenantId">Directory (Tenant) ID</Label>
              <Input
                id="tenantId"
                placeholder="Enter your Microsoft tenant ID"
                value={tenantId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTenantId(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="clientSecret">Client Secret</Label>
              <Input
                id="clientSecret"
                type="password"
                placeholder="Enter your client secret"
                value={clientSecret}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClientSecret(e.target.value)}
                required
              />
            </div>
          </CardContent>
          
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Authenticating..." : "Log In"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

// Add TypeScript declarations for Electron API
declare global {
  interface Window {
    electronAPI?: {
      login: (credentials: { clientId: string; clientSecret: string; tenantId: string }) => Promise<{ success: boolean; message?: string }>;
      logout: () => Promise<{ success: boolean }>;
      onApiReady: (callback: () => void) => void;
      onApiError: (callback: (message: string) => void) => void;
      onShowLogin: (callback: () => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}
