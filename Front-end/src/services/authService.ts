/**
 * Service module for handling Intune authentication and PowerShell command execution.
 * This service provides a clean interface for the frontend to interact with the backend API
 * for managing Intune connections and executing PowerShell commands.
 */

import { API_BASE_URL } from '../config';

/**
 * Response interface for authentication operations (login/logout)
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
   * @param clientId - Optional client ID for direct connection
   * @returns Promise resolving to AuthResponse with connection status
   */
  async login(tenantId?: string, clientId?: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/intune/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tenant_id: tenantId, client_id: clientId })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
          throw new Error(result.error || result.detail || `HTTP error! status: ${response.status}`);
      }
      
      return {
        success: true,
        tenantId: result.tenant_id,
        message: result.message
      };
      
    } catch (error) {
      console.error('Login failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred during login'
      };
    }
  },

  /**
   * Terminates the current Intune connection
   * @returns Promise resolving to AuthResponse with disconnection status
   */
  async logout(): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/intune/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.detail || `HTTP error! status: ${response.status}`);
      }
      
      return { success: true, message: result.message };

    } catch (error) {
      console.error('Logout failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred during logout'
      };
    }
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