"""
API endpoint for app library deployments
This module handles the deployment of app library applications to Intune
"""

import os
import tempfile
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import aiohttp

# Import the new app library uploader
from .functions.app_library_intune_uploader import upload_app_library_intunewin

# Import BackBlaze utilities from its new location
from .functions.backblaze_utils import get_file_download_url

router = APIRouter()
logger = logging.getLogger(__name__)

class AppLibraryDeployRequest(BaseModel):
    """Request model for app library deployments"""
    backblaze_path: str
    display_name: str
    package_id: str # Added as per plan
    publisher: Optional[str] = None
    description: Optional[str] = None
    detection_script: Optional[str] = None
    install_command: Optional[str] = None
    uninstall_command: Optional[str] = None

# The path here will be relative to the prefix defined in api/api.py (e.g. /app-library)
# So if prefix is /app-library, this endpoint becomes /app-library/deploy
@router.post("/deploy", response_model=dict, status_code=201)
async def deploy_app_library_app(body: AppLibraryDeployRequest):
    """
    Deploy an application from the app library to Intune.
    
    This endpoint:
    1. Downloads the .intunewin file from BackBlaze
    2. Uploads it to Intune using custom install/uninstall commands
    3. Returns the Intune app ID
    
    Parameters
    ----------
    backblaze_path : str
        The path to the .intunewin file in BackBlaze
    display_name : str
        The name to display in Intune
    package_id : str
        The app's unique identifier from the app library.
    publisher : str, optional
        The publisher name
    description : str, optional
        The description to show in Intune
    detection_script : str, optional
        A PowerShell detection script
    install_command : str, optional
        Custom install command
    uninstall_command : str, optional
        Custom uninstall command
    
    Returns
    -------
    dict
        A dictionary containing the Intune app ID
    """
    try:
        download_url = await get_file_download_url(body.backblaze_path)
        if not download_url:
            raise HTTPException(status_code=404, detail=f"File not found in BackBlaze: {body.backblaze_path}")
        
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_file_path = os.path.join(temp_dir, os.path.basename(body.backblaze_path))
            
            logger.info(f"Downloading file from BackBlaze: {body.backblaze_path} to {temp_file_path}")
            
            async with aiohttp.ClientSession() as session:
                async with session.get(download_url) as response:
                    if response.status != 200:
                        error_detail = f"Failed to download file from BackBlaze: {await response.text()}"
                        logger.error(error_detail)
                        raise HTTPException(
                            status_code=response.status,
                            detail=error_detail
                        )
                    
                    with open(temp_file_path, 'wb') as f:
                        while True:
                            chunk = await response.content.read(1024 * 1024)  # 1MB chunks
                            if not chunk:
                                break
                            f.write(chunk)
            
            logger.info(f"File downloaded successfully to {temp_file_path}")
            
            # Use the new app library uploader
            app_id = upload_app_library_intunewin(
                path=temp_file_path,
                display_name=body.display_name,
                package_id=body.package_id,
                description=body.description,
                publisher=body.publisher or "",
                detection_script=body.detection_script,
                install_command=body.install_command, # Will be passed to new uploader
                uninstall_command=body.uninstall_command # Will be passed to new uploader
            )
            
            logger.info(f"App deployed successfully to Intune. App ID: {app_id}")
            return {"app_id": app_id}

    except HTTPException: # Re-raise HTTPExceptions directly to preserve status code and details
        raise
    except Exception as exc:
        logger.error(f"Error deploying app: {str(exc)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred during app deployment: {str(exc)}")
