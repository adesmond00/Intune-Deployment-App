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

from fastapi import FastAPI, HTTPException, Request, Depends, Response
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel
from typing import List, Optional, Any
import uvicorn
from contextlib import asynccontextmanager # Added for lifespan
import os # Keep os import
# Removed sys import and sys.path modification
from .winget import search_applications # Back to relative import
from .middleware import cors_middleware_config # Back to relative import
# Removed import from powershell_session as it's deprecated
import asyncio
import httpx # For making HTTP requests in the backend
from itsdangerous import URLSafeTimedSerializer # For signed cookies/state
import uuid # For generating state
import urllib.parse # For URL encoding
import json # Added for parsing JSON output from scripts
import os # Added for path operations
import hashlib # For PKCE
import base64 # For PKCE

# --- Azure AD Configuration (Replace with your actual values) ---
# It's strongly recommended to use environment variables or a secure config management system
# instead of hardcoding these, especially the client secret.
AZURE_CLIENT_ID = "YOUR_CLIENT_ID_HERE"
AZURE_TENANT_ID = "YOUR_TENANT_ID_HERE"
AZURE_CLIENT_SECRET = "YOUR_CLIENT_SECRET_HERE"
# The redirect URI configured in your Azure AD App Registration (Points to THIS backend)
AZURE_REDIRECT_URI = "http://localhost:8000/auth/callback" # Make sure this matches Azure AD
# Frontend URL configuration (Where the user UI runs)
FRONTEND_BASE_URL = "http://localhost:5173"
FRONTEND_CALLBACK_URL = f"{FRONTEND_BASE_URL}/auth/callback" # Full URL for frontend callback route
# Scope required for Intune and offline access (refresh tokens)
AZURE_SCOPES = ["openid", "profile", "offline_access", "https://graph.microsoft.com/.default"]
# ------------------------------------------------------------------

# --- Security Configuration ---
# REPLACE WITH A STRONG, SECRET KEY - Keep this secret!
# Consider loading from environment variable.
ITSANGEROUS_SECRET_KEY = "YOUR_SECRET_KEY_HERE_REPLACE_ME"
# Check for placeholder secret key
if ITSANGEROUS_SECRET_KEY == "YOUR_SECRET_KEY_HERE_REPLACE_ME":
    print("WARNING: Placeholder ITSANGEROUS_SECRET_KEY detected in api/api.py.")
    print("Replace this with a strong, unique secret key and keep it secure.")
    print("Consider using environment variables.")

# Serializer for signing state and session data
serializer = URLSafeTimedSerializer(ITSANGEROUS_SECRET_KEY)
# Cookie configuration
STATE_COOKIE_NAME = "auth_state"
SESSION_COOKIE_NAME = "auth_session"
COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60 # 7 days for refresh token persistence
# ----------------------------

# Check if placeholders are still present (basic check)
if AZURE_CLIENT_ID == "YOUR_CLIENT_ID_HERE" or \
   AZURE_TENANT_ID == "YOUR_TENANT_ID_HERE" or \
   AZURE_CLIENT_SECRET == "YOUR_CLIENT_SECRET_HERE":
    print("WARNING: Azure AD configuration placeholders detected in api/api.py.")
    print("Replace YOUR_CLIENT_ID_HERE, YOUR_TENANT_ID_HERE, and YOUR_CLIENT_SECRET_HERE.")
    print("Consider using environment variables for security.")


# --- Lifespan Management ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Code to run on startup can go here
    print("Application startup.")
    yield
    # Code to run on shutdown
    print("Application shutdown.")
    # If any cleanup from the old powershell_session was needed, it would go here.
    # For now, just printing.

# Initialize FastAPI application with metadata and lifespan manager
app = FastAPI(
    title="Intune Deployment Toolkit API",
    description="API for managing Intune deployments and configurations (OAuth Flow)",
    version="1.1.0", # Consider bumping version if changes are significant
    lifespan=lifespan
)

# Apply CORS middleware using the imported configuration
app.add_middleware(**cors_middleware_config)

# Removed deprecated @app.on_event("shutdown")

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
    Represents an Intune connection request. (DEPRECATED)

    Attributes:
        tenant_id (Optional[str]): The Azure AD tenant ID
        client_id (Optional[str]): The Azure AD client ID (less common for interactive)
    """
    tenant_id: Optional[str] = None
    client_id: Optional[str] = None

# In-memory storage for deployments (replace with database in production)
deployments = []


# --- Authentication Endpoints ---

@app.get("/auth/login")
async def auth_login(request: Request, response: Response):
    """
    Initiates the OAuth 2.0 Authorization Code Grant flow.
    Generates a state parameter, stores it in a cookie, and redirects the user
    to the Microsoft identity platform authorization endpoint.
    """
    # Generate state and PKCE parameters
    state = str(uuid.uuid4())
    code_verifier = base64.urlsafe_b64encode(os.urandom(32)).rstrip(b'=').decode('utf-8')
    code_challenge = base64.urlsafe_b64encode(hashlib.sha256(code_verifier.encode('utf-8')).digest()).rstrip(b'=').decode('utf-8')
    
    # Store state and code_verifier in the cookie payload
    state_payload = {"state": state, "pkce_verifier": code_verifier}

    # Construct the authorization URL with PKCE parameters
    authorization_url = (
        f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/oauth2/v2.0/authorize?"
        + urllib.parse.urlencode({
            "client_id": AZURE_CLIENT_ID,
            "response_type": "code",
            "redirect_uri": AZURE_REDIRECT_URI,
            "response_mode": "query",
            "scope": " ".join(AZURE_SCOPES),
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256", # Using SHA256
        })
    )
    
    # Create a redirect response
    redirect_response = RedirectResponse(url=authorization_url, status_code=302)
    
    # Set the state payload (including verifier) in a temporary, signed cookie
    redirect_response.set_cookie(
        key=STATE_COOKIE_NAME,
        value=serializer.dumps(state_payload), # Sign the combined state and verifier
        max_age=600, # State cookie valid for 10 minutes
        httponly=True,
        samesite="lax", # Lax is usually sufficient for OAuth redirects
        secure=request.url.scheme == "https", # Use secure cookies if served over HTTPS
    )

    print(f"Redirecting to Microsoft login: {authorization_url}") # Debug log
    return redirect_response

@app.get("/auth/callback")
async def auth_callback(request: Request, response: Response, code: str = None, state: str = None, error: str = None, error_description: str = None):
    """
    Handles the redirect back from the Microsoft identity platform after user authentication.
    Validates the state, exchanges the authorization code for tokens, stores tokens
    in a secure session cookie, and redirects the user back to the frontend.
    """
    print(f"Callback received: code={code}, state={state}, error={error}") # Debug log

    # Check for errors from Microsoft
    if error:
        print(f"Error during authentication: {error} - {error_description}")
        # Redirect to a frontend error page or show an error
        # For simplicity, redirecting back to root with error query params
        error_params = urllib.parse.urlencode({"auth_error": error, "auth_error_desc": error_description})
        # Redirect to frontend base URL with error parameters
        frontend_error_url = f"{FRONTEND_BASE_URL}/?{error_params}"
        return RedirectResponse(url=frontend_error_url) # Redirect to frontend with error

    # Retrieve the state from the cookie
    state_cookie = request.cookies.get(STATE_COOKIE_NAME)
    if not state_cookie:
        raise HTTPException(status_code=400, detail="State cookie missing.")

    try:
        # Load the state payload (which includes the verifier)
        state_payload = serializer.loads(state_cookie, max_age=600) # Use same max_age as set
        original_state = state_payload.get("state")
        code_verifier = state_payload.get("pkce_verifier")

        # Verify the state parameter matches the state value in the cookie
        if original_state != state:
            raise HTTPException(status_code=400, detail="Invalid state parameter.")
        if not code_verifier:
             raise HTTPException(status_code=400, detail="Missing PKCE verifier in state cookie.")

    except Exception as e:
        print(f"State validation failed: {e}")
        raise HTTPException(status_code=400, detail="State validation failed.")

    # --- Exchange authorization code for tokens ---
    token_url = f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/oauth2/v2.0/token"
    token_data = {
        "client_id": AZURE_CLIENT_ID,
        "scope": " ".join(AZURE_SCOPES),
        "code": code,
        "redirect_uri": AZURE_REDIRECT_URI,
        "grant_type": "authorization_code",
        "client_secret": AZURE_CLIENT_SECRET,  # Required for confidential clients
        "code_verifier": code_verifier  # Required for PKCE flow
    }
    
    async with httpx.AsyncClient() as client:
        try:
            token_response = await client.post(token_url, data=token_data)
            token_response.raise_for_status() # Raise exception for 4xx/5xx responses
            tokens = token_response.json()
            print("Tokens received successfully.") # Debug log
        except httpx.HTTPStatusError as e:
            print(f"Token exchange failed: {e.response.status_code} - {e.response.text}")
            raise HTTPException(status_code=500, detail=f"Failed to exchange code for token: {e.response.text}")
        except Exception as e:
            print(f"Token exchange failed with unexpected error: {e}")
            raise HTTPException(status_code=500, detail="An unexpected error occurred during token exchange.")

    # --- Store tokens securely in a session cookie ---
    # We only need to store the refresh token long-term. Access token is short-lived.
    # We can also store user info if needed (e.g., from id_token if requested/parsed)
    session_data = {
        "refresh_token": tokens.get("refresh_token"),
        "access_token": tokens.get("access_token"), # Store access token for immediate use
        "expires_at": asyncio.get_event_loop().time() + tokens.get("expires_in", 3600) - 60, # Store expiry time (with buffer)
        "tenant_id": AZURE_TENANT_ID # Store tenant ID for reference
        # Add other user info here if parsed from id_token
    }

    # Redirect back to the dedicated frontend callback route using the configured constant
    redirect_response = RedirectResponse(url=FRONTEND_CALLBACK_URL, status_code=302)

    # Set the session cookie containing the tokens
    redirect_response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=serializer.dumps(session_data), # Sign the session data
        max_age=COOKIE_MAX_AGE_SECONDS, # Long-term persistence for refresh token
        httponly=True, # Prevent client-side script access
        samesite="lax",
        secure=request.url.scheme == "https",
    )

    # Clear the temporary state cookie
    redirect_response.delete_cookie(STATE_COOKIE_NAME)

    print("Authentication successful, redirecting to frontend.") # Debug log
    return redirect_response


@app.get("/auth/logout")
async def auth_logout(request: Request):
    """
    Logs the user out by clearing the session cookie and redirecting
    to the Microsoft identity platform end session endpoint.
    """
    # Construct the Microsoft logout URL
    # Construct the Microsoft logout URL
    logout_url = (
        f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/oauth2/v2.0/logout?"
        + urllib.parse.urlencode({
            # Redirect back to frontend base URL after logout using the configured constant
            "post_logout_redirect_uri": FRONTEND_BASE_URL
        })
    )

    # Create a redirect response to Microsoft logout
    redirect_response = RedirectResponse(url=logout_url, status_code=302)

    # Clear the session cookie
    redirect_response.delete_cookie(SESSION_COOKIE_NAME)
    print("Logging out, clearing session cookie and redirecting to Microsoft.") # Debug log

    return redirect_response

# --- End Authentication Endpoints ---


# --- Token Refresh Logic ---

async def refresh_access_token(refresh_token: str) -> Optional[dict]:
    """
    Uses a refresh token to obtain a new access token from Microsoft.

    Args:
        refresh_token: The refresh token to use.

    Returns:
        A dictionary containing the new token details (access_token, expires_in, etc.)
        or None if refresh fails.
    """
    token_url = f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/oauth2/v2.0/token"
    token_data = {
        "client_id": AZURE_CLIENT_ID,
        "scope": " ".join(AZURE_SCOPES),
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
        "client_secret": AZURE_CLIENT_SECRET,
    }

    async with httpx.AsyncClient() as client:
        try:
            token_response = await client.post(token_url, data=token_data)
            token_response.raise_for_status()
            new_tokens = token_response.json()
            print("Access token refreshed successfully.") # Debug log
            return new_tokens
        except httpx.HTTPStatusError as e:
            print(f"Token refresh failed: {e.response.status_code} - {e.response.text}")
            # If refresh fails (e.g., token expired/revoked), return None
            return None
        except Exception as e:
            print(f"Token refresh failed with unexpected error: {e}")
            return None

# --- Dependency for getting current authenticated session ---

async def get_current_session(request: Request, response: Response) -> dict:
    """
    FastAPI dependency to get validated session data from the session cookie.
    Handles access token expiry and refresh automatically.
    Raises HTTPException if not authenticated or session is invalid/expired.
    """
    session_cookie = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_cookie:
        raise HTTPException(status_code=401, detail="Not authenticated", headers={"WWW-Authenticate": "Bearer"})

    try:
        # Use max_age=None here to check signature validity regardless of timestamp for loading
        # We will check the expires_at field manually later
        session_data = serializer.loads(session_cookie, max_age=None)
    except Exception as e:
        print(f"Session cookie validation failed: {e}")
        # Clear potentially invalid cookie and raise error
        response.delete_cookie(SESSION_COOKIE_NAME)
        raise HTTPException(status_code=401, detail="Invalid or expired session", headers={"WWW-Authenticate": "Bearer"})

    # Check if refresh token exists (essential for long-term session)
    if not session_data.get("refresh_token"):
        print("Session data missing refresh token.")
        response.delete_cookie(SESSION_COOKIE_NAME)
        raise HTTPException(status_code=401, detail="Invalid session data (missing refresh token)", headers={"WWW-Authenticate": "Bearer"})


    # Check if access token is expired
    current_time = asyncio.get_event_loop().time()
    if session_data.get("expires_at", 0) < current_time:
        print("Access token expired, attempting refresh...")
        refresh_token = session_data.get("refresh_token")
        # No need to check refresh_token again, already did above

        new_tokens = await refresh_access_token(refresh_token)
        if not new_tokens:
            response.delete_cookie(SESSION_COOKIE_NAME)
            raise HTTPException(status_code=401, detail="Session expired (refresh failed), please log in again", headers={"WWW-Authenticate": "Bearer"})

        # Update session data with new tokens
        session_data["access_token"] = new_tokens.get("access_token")
        # Update refresh token only if a new one was provided in the response
        if new_tokens.get("refresh_token"):
             session_data["refresh_token"] = new_tokens.get("refresh_token")
        session_data["expires_at"] = current_time + new_tokens.get("expires_in", 3600) - 60

        # Update the session cookie with refreshed data
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=serializer.dumps(session_data),
            max_age=COOKIE_MAX_AGE_SECONDS,
            httponly=True,
            samesite="lax",
            secure=request.url.scheme == "https",
        )
        print("Session cookie updated with refreshed token.")

    # Return the validated (and potentially refreshed) session data
    return session_data


@app.get("/")
async def root():
    """
    Root endpoint that provides a welcome message.

    Returns:
        dict: A welcome message
    """
    return {"message": "Welcome to the Intune Deployment Toolkit API"}

@app.get("/intune/status", response_model=dict) # Added response model for clarity
async def get_intune_status(session: dict = Depends(get_current_session, use_cache=False)): # Protect endpoint, disable caching
    """
    Check the current Intune connection status based on the valid session cookie.
    NOTE: This no longer relies on the persistent PowerShell session manager status.

    Returns:
        dict: Status information containing:
            - active: Boolean indicating if a session is active
            - tenant_id: Current tenant ID from the session.
            - access_token_expires_at: Approximate expiry time of the current access token.
    """
    # If we reach here, get_current_session validated the session (and refreshed if needed)
    return {
        "active": True, # Considered active if session cookie is valid
        "tenant_id": session.get("tenant_id"),
        "access_token_expires_at": session.get("expires_at")
        # We don't have a persistent PS session timeout anymore
    }

# --- Deprecate/Remove Old Persistent Session Endpoints ---
# @app.post("/intune/connect")
# async def connect_intune(connection_request: IntuneConnectionRequest):
#     """
#     DEPRECATED: Use /auth/login flow instead.
#     Starts a persistent PowerShell session and connects to Intune.
#     Uses the PowerShellSessionManager.

#     Args:
#         connection_request (IntuneConnectionRequest): Connection details.

#     Returns:
#         dict: Connection result containing success status and tenant information.

#     Raises:
#         HTTPException: If starting the session or connecting fails.
#     """
#     raise HTTPException(status_code=410, detail="Endpoint deprecated. Use /auth/login flow.")


# @app.post("/intune/disconnect")
# async def disconnect_intune():
#     """
#     DEPRECATED: Use /auth/logout flow instead.
#     Disconnects from Intune by terminating the persistent PowerShell session.
#     Uses the PowerShellSessionManager.

#     Returns:
#         dict: Disconnection result containing success status.
#     """
#     raise HTTPException(status_code=410, detail="Endpoint deprecated. Use /auth/logout flow.")

# --- End Deprecated Endpoints ---

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
async def execute_script(script_request: ScriptExecutionRequest, session: dict = Depends(get_current_session)):
    """
    Execute a PowerShell command or script block.
    Authentication is handled by passing the access token from the validated session.
    This no longer uses the persistent PowerShell session manager directly for execution.

    Args:
        script_request (ScriptExecutionRequest): The request containing the command.
        session (dict): The validated session data injected by the dependency.

    Returns:
        dict: A dictionary containing execution results:
            - success: Boolean indicating success.
            - output: Script/command output (parsed as JSON if requested and possible).
            - error: Any error messages.

    Raises:
        HTTPException: If execution fails significantly.
    """
    access_token = session.get("access_token")
    if not access_token:
        # This shouldn't happen if get_current_session works correctly, but check anyway
        raise HTTPException(status_code=401, detail="Missing access token in session.")

    # Placeholder implementation:
    print(f"Executing script: {script_request.command} with token (first 10 chars): {access_token[:10]}...")

    # --- Replace below with actual subprocess execution ---
    # Example using asyncio.create_subprocess_exec (more modern)
    try:
        # NOTE: Adjust script path and parameter passing method as needed!
        # This example assumes the command is the script path and parameters are separate.
        # If the command IS the full command line, adjust accordingly.
        # SECURITY: Ensure script_request.command is validated/sanitized if it determines the script path.

        # Example: Assuming command is just the script name like "Add-App-to-Intune.ps1"
        # Construct full path relative to the API file's location might be safer
        script_dir = os.path.dirname(os.path.abspath(__file__))
        script_path = os.path.join(script_dir, '..', 'scripts', script_request.command) # Go up one level to project root, then into scripts

        if not os.path.isfile(script_path):
             raise FileNotFoundError(f"Script file not found at calculated path: {script_path}")

        # Construct parameters - MUST include passing the token securely
        params_list = []
        if script_request.parameters:
            for k, v in script_request.parameters.items():
                 # Basic quoting for safety, might need refinement based on script needs
                 safe_v = str(v).replace("'", "''")
                 params_list.extend([f"-{k}", f"'{safe_v}'"])
                 # params_list.extend([f"-{k}", str(v)]) # Original basic conversion

        # Add the access token parameter
        # Pass token securely - avoid command line if possible, consider stdin or temp file
        # For now, passing via command line argument as placeholder
        params_list.extend(["-AccessToken", access_token]) # Assuming script accepts -AccessToken

        process = await asyncio.create_subprocess_exec(
            "pwsh", # Or powershell.exe on Windows if needed
            "-File", script_path,
            *params_list,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            # Consider setting working directory if scripts expect it:
            # cwd=os.path.join(script_dir, '..', 'scripts')
        )
        stdout, stderr = await process.communicate()

        output_str = stdout.decode('utf-8', errors='ignore').strip() if stdout else ""
        error_str = stderr.decode('utf-8', errors='ignore').strip() if stderr else ""

        if process.returncode != 0:
            print(f"Script execution failed with code {process.returncode}: {error_str}")
            # Return error details, don't necessarily raise HTTPException for script errors
            return {"success": False, "output": output_str, "error": error_str or f"Script exited with code {process.returncode}"}

        # Try parsing JSON if requested
        output_data = output_str
        if script_request.parse_json:
            try:
                output_data = json.loads(output_str)
            except json.JSONDecodeError:
                print("Warning: Failed to parse script output as JSON despite request.")
                # Fallback to returning raw string output

        return {"success": True, "output": output_data, "error": error_str}

    except FileNotFoundError as e:
         print(f"Error: Script not found - {e}")
         # Use the specific error message from the exception
         raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"Error executing script: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error during script execution: {str(e)}")
    # --- End Replace ---

# Entry point for running the API server
if __name__ == "__main__":
    # Ensure running from the project root or adjust paths accordingly if running api.py directly
    # For uvicorn reload, run from project root: uvicorn api.api:app --reload --port 8000
    # Or if running this file directly:
    # import sys
    # project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    # if project_root not in sys.path:
    #     sys.path.insert(0, project_root)
    uvicorn.run("api.api:app", host="0.0.0.0", port=8000, reload=True) # Use string for reload
