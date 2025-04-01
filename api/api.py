"""
Intune Deployment Toolkit API

This FastAPI application provides endpoints for managing Intune deployments and configurations.
It includes functionality for:
- Searching for applications using winget
- Executing PowerShell scripts
- Managing deployment configurations

The API is designed to be used as part of a larger Intune deployment toolkit,
providing programmatic access to common deployment tasks.

Author: [Your Name]
Version: 1.0.0
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import subprocess
import json
from winget import search_applications
from middleware import cors_middleware_config # Import the CORS config

# Initialize FastAPI application with metadata
app = FastAPI(
    title="Intune Deployment Toolkit API",
    description="API for managing Intune deployments and configurations",
    version="1.0.0"
)

# Apply CORS middleware using the imported configuration
# Note: The configuration dictionary includes the middleware class itself.
app.add_middleware(**cors_middleware_config)


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

class ScriptExecution(BaseModel):
    """
    Represents a PowerShell script execution request.
    
    Attributes:
        script_path (str): Full path to the PowerShell script to execute
        parameters (Optional[dict]): Dictionary of parameters to pass to the script
    """
    script_path: str
    parameters: Optional[dict] = None

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

@app.get("/winget-search") # Changed from @app.post to @app.get
async def winget_search(term: str): # Changed input from Pydantic model to query parameter 'term'
    """
    Search for applications using winget via a GET request.
    
    This endpoint executes a winget search command based on the provided query parameter
    and returns the results in a structured format. It handles various edge cases
    and provides proper error handling.
    
    Args:
        term (str): The search term provided as a query parameter (e.g., /winget-search?term=Chrome)
        
    Returns:
        list: A list of found applications with their details (directly returns the result from search_applications)
            
    Raises:
        HTTPException: If the winget command fails or encounters an error
    """
    try:
        # Pass the query parameter 'term' directly to the search function
        return search_applications(term)
    except Exception as e:
        # Raise HTTPException with a 500 status code if any error occurs during search
        raise HTTPException(
            status_code=500,
            detail=f"Error performing winget search: {str(e)}"
        )

@app.post("/execute-script")
async def execute_script(script_execution: ScriptExecution):
    """
    Execute a PowerShell script with optional parameters.
    
    This endpoint runs a PowerShell script with the specified parameters
    and returns the execution results. It handles script execution errors
    and provides detailed output.
    
    Args:
        script_execution (ScriptExecution): The script execution request containing:
            - script_path: Path to the PowerShell script
            - parameters: Optional dictionary of parameters
            
    Returns:
        dict: A dictionary containing:
            - status: Success/failure status
            - output: Script output
            - error: Any error messages
            
    Raises:
        HTTPException: If the script execution fails or encounters an error
    """
    try:
        # Construct PowerShell command with execution policy bypass
        powershell_command = ["powershell.exe", "-ExecutionPolicy", "Bypass", "-File", script_execution.script_path]
        
        # Add parameters if provided
        if script_execution.parameters:
            param_string = " ".join([f"-{k} {v}" for k, v in script_execution.parameters.items()])
            powershell_command.append(param_string)
        
        # Execute the script with proper encoding
        process = subprocess.Popen(
            powershell_command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding='utf-8',
            errors='replace'
        )
        
        # Get the script output and any errors
        stdout, stderr = process.communicate()
        
        # Check if the script executed successfully
        if process.returncode == 0:
            return {
                "status": "success",
                "output": stdout,
                "error": stderr
            }
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Script execution failed: {stderr}"
            )
            
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error executing script: {str(e)}"
        )

# Entry point for running the API server
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
