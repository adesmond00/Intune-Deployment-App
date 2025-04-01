import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';

interface TenantState {
  isConnected: boolean;
  tenantId: string | null;
  clientId: string | null;
  tenantName: string | null; // Display name (can be Tenant ID or a mock name)
}

interface TenantContextProps extends TenantState {
  connect: (clientId: string, tenantId: string) => void;
  disconnect: () => void;
  mockConnect: (mockTenantName: string) => void;
  mockDisconnect: () => void;
}

const TenantContext = createContext<TenantContextProps | undefined>(undefined);

const initialState: TenantState = {
  isConnected: false,
  tenantId: null,
  clientId: null,
  tenantName: null,
};

export const TenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tenantState, setTenantState] = useState<TenantState>(() => {
    const storedState = localStorage.getItem('tenantConnection');
    return storedState ? JSON.parse(storedState) : initialState;
  });

  useEffect(() => {
    localStorage.setItem('tenantConnection', JSON.stringify(tenantState));
  }, [tenantState]);

  const connect = (clientId: string, tenantId: string) => {
    // In a real scenario, this would likely involve an API call to validate
    // For now, just update the frontend state and use Tenant ID as name
    setTenantState({
      isConnected: true,
      tenantId: tenantId,
      clientId: clientId,
      tenantName: tenantId, // Use Tenant ID as name for now
    });
  };

  const disconnect = () => {
    // Add API call here if needed for backend logout/cleanup
    setTenantState(initialState);
  };

  const mockConnect = (mockTenantName: string) => {
    setTenantState({
      isConnected: true,
      tenantId: 'mock-tenant-id',
      clientId: 'mock-client-id',
      tenantName: mockTenantName,
    });
  };

  const mockDisconnect = () => {
    // If the current connection is a mock one, disconnect.
    // This prevents accidentally disconnecting a real connection via the mock toggle.
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
