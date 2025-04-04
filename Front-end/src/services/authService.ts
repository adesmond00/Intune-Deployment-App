/**
 * Service module for handling authentication initiation and backend API interaction.
 * This service provides a clean interface for the frontend to interact with the backend API.
 * Authentication is initiated by redirecting to backend endpoints which handle the OAuth flow.
 */

import { API_BASE_URL } from '../config';
// MSAL imports are removed as the primary interaction is now redirect-based via the backend

// Removed unused AuthResponse interface

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

// Add rate limiting
const RATE_LIMIT_DELAY = 5000; // 5 seconds between status checks
let lastStatusCheck = 0;

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
    console.log('[authService] login called. Setting flag and redirecting to backend for authentication.');
    // Set a flag to indicate authentication is in progress, used on return
    try {
      sessionStorage.setItem('auth_in_progress', 'true');
    } catch (e) {
      console.error("Failed to set sessionStorage flag:", e);
      // Proceed with redirect even if sessionStorage fails, but the loading indicator might not work
    }
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
  async getStatus(): Promise<{ active: boolean; tenant_id?: string; access_token_expires_at?: number }> {
    // Implement rate limiting
    const now = Date.now();
    if (now - lastStatusCheck < RATE_LIMIT_DELAY) {
      throw new Error('Rate limit exceeded. Please wait before checking status again.');
    }
    lastStatusCheck = now;

    try {
      const response = await fetch(`${API_BASE_URL}/intune/status`, {
        credentials: 'include', // Include cookies in the request
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { active: false };
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error checking status:', error);
      return { active: false };
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
