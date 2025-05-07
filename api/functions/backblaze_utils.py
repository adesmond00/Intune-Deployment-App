"""
BackBlaze utilities for the Intune Deployment API
"""

import os
import logging
import aiohttp
from typing import Optional
import time

logger = logging.getLogger(__name__)

# Get BackBlaze configuration from environment variables
BACKBLAZE_BUCKET_ID = os.environ.get("BACKBLAZE_BUCKET_ID")
BACKBLAZE_BUCKET_NAME = os.environ.get("BACKBLAZE_BUCKET_NAME")
BACKBLAZE_APPLICATION_KEY_ID = os.environ.get("BACKBLAZE_APPLICATION_KEY_ID")
BACKBLAZE_APPLICATION_KEY = os.environ.get("BACKBLAZE_APPLICATION_KEY")
BACKBLAZE_ENDPOINT = os.environ.get("BACKBLAZE_ENDPOINT", "https://api.backblazeb2.com")

# Cache for the auth token and download URL
auth_cache = {
    "authorization_token": None,
    "api_url": None,
    "download_url": None,
    "expires_at": 0
}

async def get_auth_token():
    """Get an authorization token from BackBlaze B2"""
    global auth_cache
    
    # Check if we have a valid cached token
    now = time.time()
    if auth_cache["authorization_token"] and auth_cache["expires_at"] > now:
        return {
            "authorization_token": auth_cache["authorization_token"],
            "api_url": auth_cache["api_url"],
            "download_url": auth_cache["download_url"]
        }
    
    # Encode credentials
    import base64
    credentials = base64.b64encode(
        f"{BACKBLAZE_APPLICATION_KEY_ID}:{BACKBLAZE_APPLICATION_KEY}".encode()
    ).decode()
    
    # Authorize account
    async with aiohttp.ClientSession() as session:
        async with session.get(
            f"{BACKBLAZE_ENDPOINT}/b2api/v2/b2_authorize_account",
            headers={"Authorization": f"Basic {credentials}"}
        ) as response:
            if response.status != 200:
                logger.error(f"Failed to authorize BackBlaze account: {await response.text()}")
                return None
            
            data = await response.json()
            
            # Cache the token for 23 hours (tokens are valid for 24 hours)
            auth_cache = {
                "authorization_token": data["authorizationToken"],
                "api_url": data["apiUrl"],
                "download_url": data["downloadUrl"],
                "expires_at": now + 23 * 60 * 60
            }
            
            return {
                "authorization_token": data["authorizationToken"],
                "api_url": data["apiUrl"],
                "download_url": data["downloadUrl"]
            }

async def get_file_download_url(file_path: str) -> Optional[str]:
    """
    Get a signed download URL for a file in BackBlaze
    
    Parameters
    ----------
    file_path : str
        The path to the file in BackBlaze
        
    Returns
    -------
    str or None
        The signed download URL, or None if the file was not found
    """
    auth = await get_auth_token()
    if not auth:
        logger.error("Failed to get BackBlaze auth token")
        return None
    
    # First, get the file ID
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{auth['api_url']}/b2api/v2/b2_list_file_names",
            headers={
                "Authorization": auth["authorization_token"],
                "Content-Type": "application/json"
            },
            json={
                "bucketId": BACKBLAZE_BUCKET_ID,
                "prefix": file_path,
                "maxFileCount": 1
            }
        ) as response:
            if response.status != 200:
                logger.error(f"Failed to list files: {await response.text()}")
                return None
            
            data = await response.json()
            if not data.get("files"):
                logger.error(f"File not found in BackBlaze: {file_path}")
                return None
            
            file_id = data["files"][0]["fileId"]
    
    # Get a download authorization
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{auth['api_url']}/b2api/v2/b2_get_download_authorization",
            headers={
                "Authorization": auth["authorization_token"],
                "Content-Type": "application/json"
            },
            json={
                "bucketId": BACKBLAZE_BUCKET_ID,
                "fileNamePrefix": file_path,
                "validDurationInSeconds": 86400  # 24 hours
            }
        ) as response:
            if response.status != 200:
                logger.error(f"Failed to get download authorization: {await response.text()}")
                return None
            
            data = await response.json()
            auth_token = data["authorizationToken"]
    
    # Construct the download URL
    download_url = f"{auth['download_url']}/file/{BACKBLAZE_BUCKET_NAME}/{file_path}?Authorization={auth_token}"
    return download_url
