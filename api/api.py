from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
# Use relative import since api.py is inside the 'api' directory
from .functions.winget import search_package

app = FastAPI(title="Intune Deployment API")

class SearchRequest(BaseModel):
    search_term: str

@app.get("/")
async def root():
    return {"message": "Welcome to the Intune Deployment API"}

# Changed the method to POST as GET requests typically don't have a request body.
@app.post("/search") # Changed to POST to accept request body
async def search_applications(request: SearchRequest):
    """
    Search for applications using winget
    """
    result = search_package(request.search_term)
    # Add error handling based on the status returned by search_package
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("error") or result.get("message", "Unknown error during winget search"))
    return result

if __name__ == "__main__":
    import uvicorn
    # When running api.py directly, Python might still struggle with the relative import
    # depending on how it's executed. Running the app via uvicorn from the project root
    # is the standard way: uvicorn api.api:app --reload
    print("Starting server with uvicorn. For development, run from project root: uvicorn api.api:app --reload")
    # Point uvicorn to the app object correctly for direct execution scenario
    uvicorn.run("api.api:app", host="0.0.0.0", port=8000, reload=True)
