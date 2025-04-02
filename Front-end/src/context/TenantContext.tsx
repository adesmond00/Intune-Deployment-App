import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { authService } from '../services/authService';

interface TenantState {
  isConnected: boolean;
  tenantId: string | null;
  tenantName: string | null;
  error: string | null;
}

interface TenantContextProps extends TenantState {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  mockConnect: (mockTenantName: string) => void;
  mockDisconnect: () => void;
}

const TenantContext = createContext<TenantContextProps | undefined>(undefined);

const initialState: TenantState = {
  isConnected: false,
  tenantId: null,
  tenantName: null,
  error: null,
};

export const TenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tenantState, setTenantState] = useState<TenantState>(() => {
    const storedState = localStorage.getItem('tenantConnection');
    return storedState ? JSON.parse(storedState) : initialState;
  });

  useEffect(() => {
    localStorage.setItem('tenantConnection', JSON.stringify(tenantState));
  }, [tenantState]);

  const connect = async () => {
    console.log('[TenantContext] connect function called.');
    try {
      setTenantState(prev => ({ ...prev, error: null }));
      console.log('[TenantContext] Calling authService.login...');
      const result = await authService.login();
      console.log('[TenantContext] Received result from authService.login:', result);
      
      if (result.success && result.tenantId) {
        console.log('[TenantContext] Login successful, updating state.');
        setTenantState({
          isConnected: true,
          tenantId: result.tenantId,
          tenantName: result.tenantId, // You could fetch a more friendly name if needed
          error: null,
        });
      } else {
        setTenantState(prev => ({
          ...prev,
          error: result.error || 'Failed to connect to tenant'
        }));
        throw new Error(result.error || 'Failed to connect to tenant');
      }
    } catch (error) {
      console.error('[TenantContext] Error during connect:', error);
      setTenantState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to connect to tenant'
      }));
      throw error;
    }
  };

  const disconnect = async () => {
    try {
      setTenantState(prev => ({ ...prev, error: null }));
      const result = await authService.logout();
      
      if (result.success) {
        setTenantState(initialState);
      } else {
        setTenantState(prev => ({
          ...prev,
          error: result.error || 'Failed to disconnect from tenant'
        }));
        throw new Error(result.error || 'Failed to disconnect from tenant');
      }
    } catch (error) {
      console.error('Failed to disconnect:', error);
      setTenantState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to disconnect from tenant'
      }));
      throw error;
    }
  };

  const mockConnect = (mockTenantName: string) => {
    setTenantState({
      isConnected: true,
      tenantId: 'mock-tenant-id',
      tenantName: mockTenantName,
      error: null,
    });
  };

  const mockDisconnect = () => {
    if (tenantState.tenantId === 'mock-tenant-id') {
      setTenantState(initialState);
    }
  };

  return (
    <TenantContext.Provider value={{ ...tenantState, connect, disconnect, mockConnect, mockDisconnect }}>
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
