"""
Intune Deployment Toolkit API

This FastAPI application provides endpoints for managing Intune deployments and configurations.
It includes functionality for:
- Searching for applications using winget
- Executing PowerShell scripts via a persistent session
- Managing deployment configurations
- Connecting to and managing Intune via a persistent session

The API is designed to be used as part of a larger Intune deployment toolkit,
providing programmatic access to common deployment tasks.

Author: [Your Name]
Version: 1.1.0
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Any
import uvicorn
from winget import search_applications
from middleware import cors_middleware_config
from powershell_session import powershell_session_manager, cleanup_powershell_session, SESSION_TIMEOUT_MINUTES
import asyncio

# Initialize FastAPI application with metadata
app = FastAPI(
    title="Intune Deployment Toolkit API",
    description="API for managing Intune deployments and configurations with persistent PowerShell session",
    version="1.1.0"
)

# Apply CORS middleware using the imported configuration
app.add_middleware(**cors_middleware_config)

# Register cleanup function on shutdown
@app.on_event("shutdown")
async def shutdown_event():
    await cleanup_powershell_session()

# Data Models
class Deployment(BaseModel):
    """
    Represents an Intune deployment configuration.
    
    Attributes:
        id (str): Unique identifier for the deployment
        name (str): Display name of the deployment
        description (Optional[str]): Detailed description of the deployment
        status (str): Current status of the deployment
        target_devices (List[str]): List of device IDs targeted by this deployment
    """
    id: str
    name: str
    description: Optional[str] = None
    status: str
    target_devices: List[str]

class ScriptExecutionRequest(BaseModel):
    """
    Represents a request to execute a PowerShell command or script.
    
    Attributes:
        command (str): The PowerShell command or script block to execute.
        # script_path: Optional[str] = None # Keep command for flexibility
        parameters: Optional[dict] = None # Parameters might be handled within the command string itself
        parse_json: bool = False # Hint to try parsing output as JSON
    """
    command: str
    # script_path: Optional[str] = None
    parameters: Optional[dict] = None # Keep for potential future use, but command is primary
    parse_json: bool = False

class IntuneConnectionRequest(BaseModel):
    """
    Represents an Intune connection request.
    
    Attributes:
        tenant_id (Optional[str]): The Azure AD tenant ID
        client_id (Optional[str]): The Azure AD client ID (less common for interactive)
    """
    tenant_id: Optional[str] = None
    client_id: Optional[str] = None

# In-memory storage for deployments (replace with database in production)
deployments = []

@app.get("/")
async def root():
    """
    Root endpoint that provides a welcome message.
    
    Returns:
        dict: A welcome message
    """
    return {"message": "Welcome to the Intune Deployment Toolkit API"}

@app.get("/intune/status")
async def get_intune_status():
    """
    Check the current Intune connection status via the session manager.
    
    Returns:
        dict: Status information containing:
            - active: Boolean indicating if a session is active
            - tenant_id: Current tenant ID (if session active)
            - session_timeout_minutes: Configured session timeout
    """
    status = await powershell_session_manager.get_status()
    status["session_timeout_minutes"] = SESSION_TIMEOUT_MINUTES # Add config info
    return status

@app.post("/intune/connect")
async def connect_intune(connection_request: IntuneConnectionRequest):
    """
    Starts a persistent PowerShell session and connects to Intune.
    Uses the PowerShellSessionManager.
    
    Args:
        connection_request (IntuneConnectionRequest): Connection details.
        
    Returns:
        dict: Connection result containing success status and tenant information.
        
    Raises:
        HTTPException: If starting the session or connecting fails.
    """
    result = await powershell_session_manager.start_session(
        tenant_id=connection_request.tenant_id, 
        client_id=connection_request.client_id
    )
    if not result.get("success"):
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Failed to connect to Intune session.")
        )
    # Return the success message and tenant ID from the session manager result
    return {
        "success": True, 
        "message": result.get("message", "Connected successfully."), 
        "tenant_id": result.get("tenant_id")
    }

@app.post("/intune/disconnect")
async def disconnect_intune():
    """
    Disconnects from Intune by terminating the persistent PowerShell session.
    Uses the PowerShellSessionManager.
    
    Returns:
        dict: Disconnection result containing success status.
    """
    await powershell_session_manager.terminate_session("User requested disconnect")
    return {"success": True, "message": "Session terminated successfully."}

@app.get("/winget-search")
async def winget_search(term: str):
    """
    Search for applications using winget via a GET request.
    Note: This currently runs winget directly, not within the persistent session.
          Consider if winget needs the Intune context or if this is okay standalone.
    
    Args:
        term (str): The search term provided as a query parameter.
        
    Returns:
        list: A list of found applications with their details.
            
    Raises:
        HTTPException: If the winget command fails or encounters an error.
    """
    try:
        # For now, winget search runs outside the persistent session.
        # If winget needs the session context later, this would need adjustment.
        return search_applications(term)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error performing winget search: {str(e)}"
        )

@app.post("/execute-script")
async def execute_script(request: ScriptExecutionRequest):
    """
    Execute a PowerShell command or script block within the persistent session.
    Uses the PowerShellSessionManager.
    
    Args:
        request (ScriptExecutionRequest): The request containing the command.
            
    Returns:
        dict: A dictionary containing:
            - success: Boolean indicating success.
            - output: Script/command output (parsed as JSON if requested and possible).
            - error: Any error messages.
            
    Raises:
        HTTPException: If the session is not active or execution fails.
    """
    if not powershell_session_manager.is_active():
        raise HTTPException(
            status_code=400, # Bad Request - session not active
            detail="No active Intune PowerShell session. Please connect first."
        )
        
    # Basic parameter injection (use with caution - ensure proper escaping in command)
    command_to_run = request.command
    if request.parameters:
         param_string = " ".join([f"-{k} '{v}'" for k, v in request.parameters.items()]) # Basic quoting
         # This assumes parameters are appended; adjust if script takes them differently
         # SECURITY: This is a naive implementation. Be very careful about injection.
         # Consider structured parameter passing if possible within PowerShell.
         command_to_run = f"{command_to_run} {param_string}" 

    result = await powershell_session_manager.execute_command(
        command=command_to_run,
        parse_json=request.parse_json
    )
    
    if not result.get("success", False):
        # Don't raise HTTPException for script errors unless severe?
        # Return the error details in the response body for the frontend to handle.
        return JSONResponse(
            status_code=200, # Or maybe 400/500 depending on error type? User script error vs session error
            content=result
        )
        # raise HTTPException(
        #     status_code=500, 
        #     detail=result.get("error", "Script execution failed within session.")
        # )
            
    return result

# Entry point for running the API server
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
