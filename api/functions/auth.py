"""
Microsoft Graph API Authentication Module

This module provides functions to authenticate with Microsoft Graph API using MSAL
(Microsoft Authentication Library) and manage access tokens for application access.

Authentication Implementation:
-----------------------------
This module implements the client credentials flow (app-only authentication) for Microsoft Graph API.
This flow is suitable for daemon services, background processes, and server-side applications
that need to access Microsoft Graph without user interaction.

Azure/Microsoft Entra Setup:
--------------------------
1. Register an application in the Microsoft Entra admin center (https://entra.microsoft.com)
   - Go to "App registrations" and click "New registration"
   - Name your application and select the appropriate supported account type
   - No redirect URI is required for client credentials flow
   - Click "Register"

2. Create a client secret:
   - In your app registration, go to "Certificates & secrets"
   - Create a new client secret, set an appropriate expiration
   - Copy the VALUE of the secret immediately (you won't be able to see it again)

3. Configure API permissions:
   - In your app registration, go to "API permissions"
   - Click "Add a permission" and select "Microsoft Graph"
   - Choose "Application permissions" (not Delegated)
   - Add the required permissions based on your app needs (e.g., DeviceManagementApps.ReadWrite.All)
   - Click "Add permissions"
   - IMPORTANT: Click "Grant admin consent" (requires admin account)

4. Configure environment variables in your application:
   - GRAPH_CLIENT_ID: The Application (client) ID from the Overview page
   - GRAPH_CLIENT_SECRET: The client secret value you created
   - GRAPH_TENANT_ID: Your directory (tenant) ID from the Overview page

Usage in Application:
-------------------
To use this module in your API endpoints:

```python
# Import the module
from api.functions.auth import get_auth_headers

# Get authorization headers for Graph API calls
def my_graph_api_endpoint():
    headers = get_auth_headers()
    
    # Make requests to Graph API
    response = requests.get(
        'https://graph.microsoft.com/v1.0/deviceManagement/mobileApps',
        headers=headers
    )
    
    # Process the response
    return response.json()
```

Security Considerations:
----------------------
- NEVER commit client secrets to source control
- Use environment variables, Azure Key Vault, or another secure storage for secrets
- Implement proper error handling for authentication failures
- Consider using Azure Managed Identity in production environments
- Rotate client secrets periodically
"""

import os
import time
import logging
from typing import Dict, Optional
import msal
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cache to store the token in memory
_token_cache = {
    "access_token": None,
    "expires_at": 0
}

def get_auth_config() -> Dict[str, str]:
    """
    Get authentication configuration from environment variables or configuration file.
    
    Returns:
        Dict containing client_id, client_secret, tenant_id, and authority
    """
    # Get credentials from environment variables
    config = {
        "client_id": os.environ.get("GRAPH_CLIENT_ID"),
        "client_secret": os.environ.get("GRAPH_CLIENT_SECRET"),
        "tenant_id": os.environ.get("GRAPH_TENANT_ID"),
    }
    
    # Construct the authority URL (https://login.microsoftonline.com/{tenant_id})
    config["authority"] = f"https://login.microsoftonline.com/{config['tenant_id']}"
    
    # Check if required config is available
    required_keys = ["client_id", "client_secret", "tenant_id"]
    missing_keys = [key for key in required_keys if not config.get(key)]
    
    if missing_keys:
        logger.error(f"Missing required configuration: {', '.join(missing_keys)}")
    
    return config

def get_access_token(scopes: Optional[list] = None) -> Optional[str]:
    """
    Get an access token for Microsoft Graph API.
    
    Args:
        scopes: List of permission scopes to request. Defaults to ["https://graph.microsoft.com/.default"]
    
    Returns:
        Access token string or None if authentication fails
    """
    global _token_cache
    
    # Default scopes for client credentials flow
    if scopes is None:
        scopes = ["https://graph.microsoft.com/.default"]
    
    # Check if we have a valid token in the cache
    current_time = time.time()
    if (_token_cache["access_token"] and 
            _token_cache["expires_at"] > current_time + 60):  # 60 second buffer
        logger.debug("Using cached access token")
        return _token_cache["access_token"]
    
    # Get the configuration
    config = get_auth_config()
    if not all([config.get("client_id"), config.get("client_secret"), config.get("authority")]):
        logger.error("Incomplete authentication configuration")
        return None
    
    try:
        # Create an MSAL app instance
        app = msal.ConfidentialClientApplication(
            client_id=config["client_id"],
            client_credential=config["client_secret"],
            authority=config["authority"]
        )
        
        # Acquire token using client credentials flow (app-only)
        result = app.acquire_token_for_client(scopes=scopes)
        
        if "access_token" in result:
            # Cache the token with expiration time
            _token_cache["access_token"] = result["access_token"]
            _token_cache["expires_at"] = current_time + result.get("expires_in", 3599)  # Default to 1 hour - 1 second
            logger.info("Successfully acquired new access token")
            return result["access_token"]
        else:
            # Log error details
            error = result.get("error")
            error_description = result.get("error_description")
            correlation_id = result.get("correlation_id")
            logger.error(f"Failed to acquire token. Error: {error}, Description: {error_description}, Correlation ID: {correlation_id}")
            return None
            
    except Exception as ex:
        logger.error(f"Exception during token acquisition: {str(ex)}")
        return None

def get_auth_headers() -> Dict[str, str]:
    """
    Get the authorization headers needed for Microsoft Graph API calls.
    
    Returns:
        Dictionary containing Authorization header with Bearer token
    """
    token = get_access_token()
    if not token:
        logger.error("No access token available for headers")
        return {}
    
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
