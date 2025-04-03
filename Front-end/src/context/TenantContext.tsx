import React, { createContext, useState, useEffect, useContext, ReactNode, useRef } from 'react';
import { authService } from '../services/authService';

const POST_REDIRECT_TIMEOUT_MS = 7000; // 7 seconds

interface TenantState {
  isConnected: boolean;
  tenantId: string | null;
  tenantName: string | null;
  error: string | null;
}

interface TenantContextProps extends TenantState {
  isLoadingStatus: boolean; // Added loading state
  mockConnect: (mockTenantName: string) => void;
  mockDisconnect: () => void;
  checkStatus: (isPostRedirect?: boolean) => Promise<void>; // Updated signature
}

const TenantContext = createContext<TenantContextProps | undefined>(undefined);

// initialState remains the same
const initialState: TenantState = {
  isConnected: false,
  tenantId: null,
  tenantName: null,
  error: null,
};

export const TenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize state directly
  const [tenantState, setTenantState] = useState<TenantState>(initialState);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false); // Added loading state
  const checkStatusTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Use useRef hook here

  // Persist state to localStorage whenever it changes (Removed for now)
  // useEffect(() => {
  //   localStorage.setItem('tenantConnection', JSON.stringify(tenantState));
  // }, [tenantState]);

  // Function to check authentication status with the backend
  const checkStatus = async (isPostRedirect = false) => {
    console.log(`[TenantContext] checkStatus called. isPostRedirect: ${isPostRedirect}`);

    // Clear previous timeout if any
    if (checkStatusTimeoutRef.current) {
      clearTimeout(checkStatusTimeoutRef.current);
      checkStatusTimeoutRef.current = null; // Clear the ref's current value
    }

    // Avoid checking status if we know we are mock-connected
    // --- Removed misplaced localStorage line and closing bracket ---
    if (tenantState.tenantId === 'mock-tenant-id') {
        console.log('[TenantContext] Skipping status check during mock connection.');
        setIsLoadingStatus(false); // Ensure loading is off
        return;
    }

    // Set loading state only if not already loading (prevents flicker on visibility change)
    if (!isLoadingStatus) setIsLoadingStatus(true);
    setTenantState(prev => ({ ...prev, error: null })); // Clear previous errors

    // Start timeout only if this is the post-redirect check
    if (isPostRedirect) {
      console.log(`[TenantContext] Starting timeout (${POST_REDIRECT_TIMEOUT_MS}ms)`);
      checkStatusTimeoutRef.current = setTimeout(() => {
        console.warn('[TenantContext] checkStatus timed out.');
        setTenantState(prev => ({
          ...initialState, // Reset state
          error: 'Connection status check timed out.',
        }));
        setIsLoadingStatus(false);
        checkStatusTimeoutRef.current = null;
      }, POST_REDIRECT_TIMEOUT_MS);
    }

    try {
      const status = await authService.getStatus();
      console.log('[TenantContext] Received status from authService.getStatus:', status);

      // Clear timeout if it hasn't fired yet and the fetch resolved
      if (checkStatusTimeoutRef.current) {
        clearTimeout(checkStatusTimeoutRef.current);
        checkStatusTimeoutRef.current = null;
      }

      if (status.active && status.tenant_id) {
        setTenantState({ // Set state directly, no prev needed here
          isConnected: true,
          tenantId: status.tenant_id ?? null,
          tenantName: status.tenant_id ?? null, // Use tenantId as name for now
          error: null,
        });
      } else {
        // If not active or error occurred during status check, reset to initial state
        setTenantState({ ...initialState, error: status.error ?? null }); // Keep potential error message from status
        if (status.error) {
             console.warn('[TenantContext] Status check indicated inactive or error:', status.error);
        } else {
             console.log('[TenantContext] Status check indicated inactive session.');
        }
      }
    } catch (error) {
      console.error('[TenantContext] Error during checkStatus fetch:', error);
      // Clear timeout if it hasn't fired yet and an error occurred during fetch
      if (checkStatusTimeoutRef.current) {
        clearTimeout(checkStatusTimeoutRef.current);
        checkStatusTimeoutRef.current = null;
      }
      // Reset to initial state on error
      setTenantState({
        ...initialState,
        error: error instanceof Error ? error.message : 'Failed to check connection status'
      });
    } finally {
      // Always ensure loading is turned off
      setIsLoadingStatus(false);
    }
  };

  // Check status on initial mount, handling the post-redirect case
  useEffect(() => {
    const authInProgress = sessionStorage.getItem('auth_in_progress');
    if (authInProgress) {
      console.log('[TenantContext] Auth in progress detected, removing flag and checking status with timeout.');
      sessionStorage.removeItem('auth_in_progress');
      checkStatus(true); // Pass true to indicate post-redirect check
    } else {
      console.log('[TenantContext] No auth in progress detected, checking status normally.');
      checkStatus(false); // Normal check
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once on mount

  // Add visibility change listener as a secondary check
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[TenantContext] Tab became visible, re-checking status.');
        // Avoid triggering if we are already loading from the initial check
        if (!isLoadingStatus && !checkStatusTimeoutRef.current) {
           checkStatus(false); // Perform a normal check, no timeout needed here
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Clear timeout on unmount as well
      if (checkStatusTimeoutRef.current) {
        clearTimeout(checkStatusTimeoutRef.current);
        checkStatusTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingStatus]); // Dependency ensures listener is updated if loading state logic changes


  // --- Mock connection functions (for debugging UI without real auth) ---
  const mockConnect = (mockTenantName: string) => {
    setIsLoadingStatus(false); // Ensure loading is off
    if (checkStatusTimeoutRef.current) {
        clearTimeout(checkStatusTimeoutRef.current); // Clear any pending timeout
        checkStatusTimeoutRef.current = null;
    }
    setTenantState({ // Set state directly
      isConnected: true,
      tenantId: 'mock-tenant-id', // Use a distinct mock ID
      tenantName: mockTenantName, // Use provided name
      error: null,
    });
  };

  const mockDisconnect = () => {
    if (tenantState.tenantId === 'mock-tenant-id') {
      setIsLoadingStatus(false); // Ensure loading is off
       if (checkStatusTimeoutRef.current) {
           clearTimeout(checkStatusTimeoutRef.current); // Clear any pending timeout
           checkStatusTimeoutRef.current = null;
       }
      setTenantState({ ...initialState }); // Reset state
    }
  };

  return (
    <TenantContext.Provider value={{ ...tenantState, isLoadingStatus, mockConnect, mockDisconnect, checkStatus }}>
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
