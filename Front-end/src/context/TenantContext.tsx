import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { authService } from '../services/authService';

interface TenantState {
  isConnected: boolean;
  tenantId: string | null;
  tenantName: string | null;
  error: string | null;
  // checkStatus removed from state interface
}

interface TenantContextProps extends TenantState {
  // connect and disconnect removed
  mockConnect: (mockTenantName: string) => void;
  mockDisconnect: () => void;
  checkStatus: () => Promise<void>; // Add checkStatus here
}

const TenantContext = createContext<TenantContextProps | undefined>(undefined);

const initialState: TenantState = {
  isConnected: false,
  tenantId: null,
  tenantName: null,
  error: null,
  // checkStatus removed from initial state definition
};

export const TenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tenantState, setTenantState] = useState<TenantState>(() => {
    const storedState = localStorage.getItem('tenantConnection');
    return storedState ? JSON.parse(storedState) : initialState;
  });

  // Persist state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('tenantConnection', JSON.stringify(tenantState));
  }, [tenantState]);

  // Function to check authentication status with the backend
  const checkStatus = async () => {
    console.log('[TenantContext] checkStatus called.');
    // Avoid checking status if we know we are mock-connected
    if (tenantState.tenantId === 'mock-tenant-id') {
        console.log('[TenantContext] Skipping status check during mock connection.');
        return;
    }
    try {
      setTenantState(prev => ({ ...prev, error: null })); // Clear previous errors
      const status = await authService.getStatus();
      console.log('[TenantContext] Received status from authService.getStatus:', status);

      if (status.active && status.tenant_id) {
        // Update state without checkStatus
        setTenantState(prev => ({
          ...prev, // Keep potential previous state like error if needed, though cleared above
          isConnected: true,
          tenantId: status.tenant_id ?? null, // Ensure null if undefined
          tenantName: status.tenant_id ?? null, // Use tenantId as name for now, ensure null if undefined
          error: null,
        }));
      } else {
        // If not active or error occurred during status check, reset to initial state
        // Ensure initialState doesn't include checkStatus
        setTenantState({ ...initialState }); 
        if (status.error) {
             console.warn('[TenantContext] Status check indicated inactive or error:', status.error);
             // Optionally set an error state here if needed, but often just being logged out is enough
             // setTenantState(prev => ({ ...initialState, error: status.error }));
        }
      }
    } catch (error) {
      console.error('[TenantContext] Error during checkStatus:', error);
      // Reset to initial state on error, ensuring checkStatus isn't included
      setTenantState({ 
        ...initialState, 
        error: error instanceof Error ? error.message : 'Failed to check connection status' 
      });
    }
  };

  // Check status when the component mounts
  useEffect(() => {
    checkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once on mount


  // --- Mock connection functions (for debugging UI without real auth) ---
  const mockConnect = (mockTenantName: string) => {
    // Update state without checkStatus
    setTenantState(prev => ({
      ...prev, // Keep potential previous state
      isConnected: true,
      tenantId: 'mock-tenant-id',
      tenantName: mockTenantName,
      error: null,
    }));
  };

  const mockDisconnect = () => {
    if (tenantState.tenantId === 'mock-tenant-id') {
      // Reset state without checkStatus
      setTenantState({ ...initialState });
    }
  };

  return (
    <TenantContext.Provider value={{ ...tenantState, mockConnect, mockDisconnect, checkStatus }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = (): TenantContextProps => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
