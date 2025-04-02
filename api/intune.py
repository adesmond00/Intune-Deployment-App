"""
Intune connection and management functionality.

This module provides functions for connecting to and managing Intune through PowerShell.
"""

import subprocess
import json
from typing import Dict, Optional

def connect_to_intune(tenant_id: Optional[str] = None, client_id: Optional[str] = None) -> Dict:
    """
    Connect to Intune using PowerShell.
    
    Args:
        tenant_id (Optional[str]): The Azure AD tenant ID
        client_id (Optional[str]): The Azure AD client ID
        
    Returns:
        Dict: A dictionary containing:
            - success: Boolean indicating if connection was successful
            - message: Success/error message
            - tenant_id: The connected tenant ID (if successful)
            - error: Error message (if unsuccessful)
    """
    try:
        # Construct PowerShell command
        script_path = "./scripts/Connect-to-Intune.ps1"
        powershell_command = ["powershell.exe", "-ExecutionPolicy", "Bypass", "-File", script_path]
        
        # Add parameters if provided
        if tenant_id:
            powershell_command.extend(["-TenantID", tenant_id])
        if client_id:
            powershell_command.extend(["-ClientID", client_id])
        
        # Execute the script
        process = subprocess.Popen(
            powershell_command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding='utf-8',
            errors='replace'
        )
        
        stdout, stderr = process.communicate()
        
        # Parse the JSON output
        try:
            result = json.loads(stdout)
            return result
        except json.JSONDecodeError:
            return {
                "success": False,
                "message": "Failed to parse script output",
                "error": stdout + stderr
            }
            
    except Exception as e:
        return {
            "success": False,
            "message": "Failed to execute connection script",
            "error": str(e)
        }

def disconnect_from_intune() -> Dict:
    """
    Disconnect from Intune using PowerShell.
    
    Returns:
        Dict: A dictionary containing:
            - success: Boolean indicating if disconnection was successful
            - message: Success/error message
            - error: Error message (if unsuccessful)
    """
    try:
        script_path = "./scripts/Disconnect-Intune.ps1"
        powershell_command = ["powershell.exe", "-ExecutionPolicy", "Bypass", "-File", script_path]
        
        process = subprocess.Popen(
            powershell_command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding='utf-8',
            errors='replace'
        )
        
        stdout, stderr = process.communicate()
        
        try:
            result = json.loads(stdout)
            return result
        except json.JSONDecodeError:
            return {
                "success": False,
                "message": "Failed to parse script output",
                "error": stdout + stderr
            }
            
    except Exception as e:
        return {
            "success": False,
            "message": "Failed to execute disconnection script",
            "error": str(e)
        } 