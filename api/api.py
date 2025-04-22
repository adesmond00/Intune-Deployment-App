from fastapi import FastAPI, HTTPException
from typing import Optional, List, Dict
# Change relative imports to absolute imports
from functions.winget import search_winget_packages
from pydantic import BaseModel
from functions.intune_win32_uploader import upload_intunewin
# Add this import for CORS
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(title="Intune Deployment API")

# Get environment variables or set defaults
debug_mode = os.environ.get("DEBUG", "true").lower() == "true"

# Make CORS configuration more dynamic
if debug_mode:
    # In development, we'll allow all localhost origins
    # This is more permissive but appropriate for local development
    origins = [
        "http://localhost:*",    # Match any port on localhost
        "http://127.0.0.1:*",    # Match any port on 127.0.0.1
    ]
else:
    # In production, we'll be more restrictive
    # Since everything will be running in one Electron app, we'll allow localhost:3000
    origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if debug_mode else origins,  # In development mode, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Welcome to the Intune Deployment API"}

@app.get("/search", response_model=List[Dict[str, str]])
async def search_applications_json(search_term: str):
    """
    Search for applications using winget and return structured JSON data.
    Pass the search term as a query parameter, e.g., /search?search_term=vscode
    
    Returns a list of applications with Name, Id, Version, and Source fields.
    """
    try:
        apps = search_winget_packages(search_term)
        if not apps:
            raise HTTPException(status_code=404, detail="No applications found matching the search term")
        return apps
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Request model for /apps endpoint
class UploadRequest(BaseModel):
    path: str
    display_name: str
    package_id: str
    publisher: Optional[str] = None
    description: Optional[str] = None


# Endpoint to upload Win32 .intunewin package to Intune
@app.post("/apps", response_model=dict, status_code=201)
async def upload_win32_app(body: UploadRequest):
    """
    Upload a Win32 `.intunewin` package to Intune.

    Body parameters
    ---------------
    path : str
        Filesystem path to the .intunewin file on the API host.
    display_name : str
        Friendly name to show in Intune.
    package_id : str
        Winget package identifier (e.g. "Notepad++.Notepad++").
    publisher : str, optional
        Publisher name; defaults to empty if omitted.
    description : str, optional
        Descriptive text shown in Intune. Defaults to display_name if omitted.
    """
    try:
        app_id = upload_intunewin(
            path=body.path,
            display_name=body.display_name,
            package_id=body.package_id,
            description=body.description,
            publisher=body.publisher or ""
        )
        return {"app_id": app_id}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

if __name__ == "__main__":
    import uvicorn
    import sys
    import argparse
    from functions.auth import get_access_token
    
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Intune Deployment API')
    parser.add_argument('--verify-only', action='store_true', 
                        help='Verify authentication credentials and exit without starting the API server')
    args = parser.parse_args()
    
    # If --verify-only is specified, just verify credentials and exit
    if args.verify_only:
        print("Verifying authentication credentials...")
        try:
            token = get_access_token()
            if token:
                print("Authentication successful: Token acquired successfully")
                sys.exit(0)  # Success
            else:
                print("Authentication failed: Could not acquire token")
                sys.exit(1)  # Failure
        except Exception as e:
            print(f"Authentication failed: {str(e)}")
            sys.exit(1)  # Failure
    
    # Otherwise, start the API server normally
    # When running api.py directly, Python might still struggle with the relative import
    # depending on how it's executed. Running the app via uvicorn from the project root
    # is the standard way: uvicorn api.api:app --reload
    print("Starting server with uvicorn. For development, run from project root: uvicorn api.api:app --reload")
    # Point uvicorn to the app object correctly for direct execution scenario
    uvicorn.run("api.api:app", host="0.0.0.0", port=8000, reload=True)
