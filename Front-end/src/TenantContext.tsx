import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { authService } from '@/services/authService';

// Define the shape of the context data
interface TenantContextProps {
  isConnecting: boolean;
  isSessionActive: boolean; // Renamed from isConnected
  connectionError: string | null;
  connectionMessage: string | null; // Added for success/info messages
  tenantId: string | null;
  connect: (tenantId?: string) => Promise<void>; // tenantId now optional
  disconnect: () => Promise<void>;
  executeCommand: (command: string, parameters?: Record<string, any>, parseJson?: boolean) => Promise<{ success: boolean; output: any; error?: string }>;
  clearError: () => void;
  clearMessage: () => void; // Added
}

// Create the context with default values
export const TenantContext = createContext<TenantContextProps>({} as TenantContextProps);

// Define the props for the provider component
interface TenantProviderProps {
  children: ReactNode;
}

// Create the provider component
export const TenantProvider: React.FC<TenantProviderProps> = ({ children }) => {
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [tenantId, setTenantId] = useState<string | null>(localStorage.getItem('tenantId'));
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);

  const clearError = () => setConnectionError(null);
  const clearMessage = () => setConnectionMessage(null);

  // Check status on initial load and periodically
  const checkStatus = useCallback(async () => {
    // Don't check status if already connecting/disconnecting
    if (isConnecting) return;
    
    try {
      console.log("Checking session status...");
      const status = await authService.getStatus();
      console.log("Status result:", status);

      // Compare fetched status with current state
      const sessionBecameInactive = !status.active && isSessionActive;
      const sessionBecameActive = status.active && !isSessionActive;
      const tenantIdChanged = status.active && status.tenant_id !== tenantId;
      const statusNeedsUpdate = sessionBecameInactive || sessionBecameActive || tenantIdChanged;

      if (statusNeedsUpdate) {
        setIsSessionActive(status.active);
        if (status.active) {
          const newTenantId = status.tenant_id || null;
          setTenantId(newTenantId);
          if (newTenantId) {
            localStorage.setItem('tenantId', newTenantId);
          }
        } else {
          setTenantId(null);
          localStorage.removeItem('tenantId');
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Rate limit exceeded')) {
        // Silently ignore rate limit errors
        return;
      }
      console.error('Error checking status:', error);
      // Don't update state on error, let the next check try again
    }
  }, [isConnecting, isSessionActive, tenantId]);

  // Use useEffect for periodic status checks with debouncing
  useEffect(() => {
    // Initial check
    checkStatus();

    // Set up periodic checks with debouncing
    const intervalId = setInterval(() => {
      checkStatus();
    }, 10000); // Check every 10 seconds

    return () => clearInterval(intervalId);
  }, [checkStatus]);

  // Function to connect to a tenant
  const connect = async (id?: string) => {
    clearError();
    clearMessage();
    setIsConnecting(true);
    
    console.log(`Attempting to connect ${id ? `to tenant ${id}`: 'interactively'}...`);
    try {
      authService.login(id);
      // The page will redirect, so we don't need to handle the result here
      // The status check will update the state when the user returns
    } catch (error) {
      setIsConnecting(false);
      setConnectionError('Failed to initiate connection process');
    }
  };

  // Function to disconnect from the tenant
  const disconnect = async () => {
    clearError();
    clearMessage();
    setIsConnecting(true);
    
    console.log("Attempting to disconnect...");
    try {
      authService.logout();
      // The page will redirect, so we don't need to handle the result here
      // The status check will update the state when the user returns
    } catch (error) {
      setIsConnecting(false);
      setConnectionError('Failed to initiate logout process');
    }
  };

  // Function to execute a command within the session
  const executeCommand = async (command: string, parameters?: Record<string, any>, parseJson?: boolean) => {
    // Clear previous messages/errors related to connection, keep command-specific ones
    clearError(); 
    clearMessage();
    
    if (!isSessionActive) {
        const errorMsg = "Cannot execute command: No active session.";
        setConnectionError(errorMsg); // Show error in the main status area
        return { success: false, output: null, error: errorMsg };
    }

    console.log(`Executing command: ${command}`);
    // Indicate activity while command runs?
    // setIsConnecting(true); // Maybe add a separate loading state for commands?
    const result = await authService.executeCommand(command, parameters, parseJson);
    // setIsConnecting(false);
    console.log("Command execution result:", result);
    
    // Don't set the main connectionError for script errors, let the caller handle it.
    // The API returns success=false in the body for script errors.
    // if (!result.success) {
    //     setConnectionError(result.error || "Command execution failed."); 
    // }
    
    // Return the full result for the calling component to handle
    return result; 
  };

  return (
    <TenantContext.Provider
      value={{
        isConnecting,
        isSessionActive,
        connectionError,
        connectionMessage,
        tenantId,
        connect,
        disconnect,
        executeCommand,
        clearError,
        clearMessage
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}; 