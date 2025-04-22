from fastapi import FastAPI, HTTPException
from typing import Optional, List, Dict
# Use relative import since api.py is inside the 'api' directory
from .functions.winget import search_winget_packages
from pydantic import BaseModel
from .functions.intune_win32_uploader import upload_intunewin

app = FastAPI(title="Intune Deployment API")

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
    # When running api.py directly, Python might still struggle with the relative import
    # depending on how it's executed. Running the app via uvicorn from the project root
    # is the standard way: uvicorn api.api:app --reload
    print("Starting server with uvicorn. For development, run from project root: uvicorn api.api:app --reload")
    # Point uvicorn to the app object correctly for direct execution scenario
    uvicorn.run("api.api:app", host="0.0.0.0", port=8000, reload=True)
