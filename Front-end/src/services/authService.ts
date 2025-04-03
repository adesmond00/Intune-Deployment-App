/**
 * Service module for handling authentication initiation and backend API interaction.
 * This service provides a clean interface for the frontend to interact with the backend API.
 * Authentication is initiated by redirecting to backend endpoints which handle the OAuth flow.
 */

import { API_BASE_URL } from '../config';
// MSAL imports are removed as the primary interaction is now redirect-based via the backend

/**
 * Response interface for authentication operations (login/logout) - Primarily for logout confirmation now.
 */
interface AuthResponse {
  success: boolean;      // Whether the operation completed successfully
  tenantId?: string;     // The ID of the connected tenant (for login)
  message?: string;      // Optional success/info message from the backend
  error?: string;        // Error message if the operation failed
}

/**
 * Response interface for PowerShell command execution
 */
interface ExecuteResponse {
  success: boolean;      // Whether the command executed successfully
  output: any;          // The command output (can be string or parsed JSON)
  error?: string;       // Error message if the command failed
}

/**
 * Response interface for checking Intune connection status
 */
interface StatusResponse {
  active: boolean;                    // Whether there is an active Intune session
  tenant_id?: string;                 // The ID of the currently connected tenant
  session_timeout_minutes?: number;    // Remaining session timeout in minutes
  error?: string;                     // Error message if status check failed
}

/**
 * Service object providing methods for Intune authentication and command execution
 */
export const authService = {
  /**
   * Establishes a connection to Intune using either provided credentials or interactive login
   * @param tenantId - Optional tenant ID for direct connection
 * @param _tenantId - No longer used directly by frontend login.
 * @param _clientId - No longer used directly by frontend login.
 * @returns This function now redirects the browser and doesn't return a Promise in the traditional sense.
 */
  login(_tenantId?: string, _clientId?: string): void {
    console.log('[authService] login called. Redirecting to backend for authentication.');
    // Redirect the browser to the backend endpoint that starts the OAuth flow
    window.location.href = `${API_BASE_URL}/auth/login`;
    // Note: No promise is returned as the page navigates away.
    // The application state will be updated upon successful redirect back from the backend callback.
  },

  /**
   * Initiates the logout process by redirecting to the backend logout endpoint.
   * @returns This function now redirects the browser and doesn't return a Promise.
   */
  logout(): void {
    console.log('[authService] logout called. Redirecting to backend for logout.');
    // Redirect the browser to the backend endpoint that handles logout
    window.location.href = `${API_BASE_URL}/auth/logout`;
    // Note: No promise is returned as the page navigates away.
  },

  /**
   * Checks the current status of the Intune connection
   * @returns Promise resolving to StatusResponse with current connection state
   */
  async getStatus(): Promise<StatusResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/intune/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result as StatusResponse;
    } catch (error) {
      console.error('Failed to check authentication status:', error);
      return { 
          active: false, 
          error: error instanceof Error ? error.message : 'Could not fetch status' 
      };
    }
  },

  /**
   * Executes a PowerShell command in the current Intune session
   * @param command - The PowerShell command to execute
   * @param parameters - Optional parameters to pass to the command
   * @param parseJson - Whether to parse the command output as JSON
   * @returns Promise resolving to ExecuteResponse with command execution results
   */
  async executeCommand(command: string, parameters?: Record<string, any>, parseJson: boolean = false): Promise<ExecuteResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/execute-script`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command, parameters, parse_json: parseJson })
      });

      const result = await response.json();

      if (!response.ok) { 
          throw new Error(result.error || result.detail || `HTTP error! status: ${response.status}`);
      }

      return result as ExecuteResponse;

    } catch (error) {
      console.error('Command execution failed:', error);
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : 'Unknown error occurred during command execution'
      };
    }
  }
};
