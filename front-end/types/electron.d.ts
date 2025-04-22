/**
 * Type definitions for Electron API exposed to the renderer process
 */

interface ElectronAPI {
  /**
   * Flag indicating if the app is running in Electron
   */
  readonly isElectron: boolean;
  
  /**
   * Login with Graph API credentials
   */
  login: (credentials: {
    clientId: string;
    clientSecret: string;
    tenantId: string;
  }) => Promise<{ success: boolean; message?: string }>;
  
  /**
   * Logout and clear credentials
   */
  logout: () => Promise<{ success: boolean }>;
  
  /**
   * Get the current API port
   */
  getApiPort: () => Promise<number>;
  
  /**
   * Event listeners
   */
  onApiReady: (callback: (port: number) => void) => void;
  onApiError: (callback: (message: string) => void) => void;
  onApiLog: (callback: (message: string) => void) => void;
  onShowLogin: (callback: () => void) => void;
  
  /**
   * Remove event listeners for specified channel
   */
  removeAllListeners: (channel: string) => void;
  
  /**
   * Get the value from the store
   */
  getStoreValue: (key: string) => Promise<any>;
}

interface Window {
  /**
   * Electron API exposed by preload script
   */
  electronAPI?: ElectronAPI;
}
