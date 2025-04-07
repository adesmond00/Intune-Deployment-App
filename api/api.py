from fastapi import FastAPI, HTTPException
from typing import Optional, List, Dict
# Use relative import since api.py is inside the 'api' directory
from .functions.winget import search_package, parse_winget_output

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
    result = search_package(search_term)
    
    if result.get("status") == "error":
        # Log the error for debugging
        print(f"Winget search error: {result.get('error') or result.get('message')}") 
        raise HTTPException(status_code=500, detail=result.get("error") or result.get("message", "Unknown error during winget search"))
    
    # Parse the output using the dedicated function
    raw_output = result.get("output", "")
    apps = parse_winget_output(raw_output)
    
    # Optional: Log if parsing returned empty list from non-empty output
    if raw_output and not apps:
        print(f"Parsing winget output resulted in empty list despite receiving output. Raw output length: {len(raw_output)}")
        # Uncomment below to log the actual raw output for debugging (can be long)
        # print(f"Raw output was:\n{raw_output}")
        
    return apps

if __name__ == "__main__":
    import uvicorn
    # When running api.py directly, Python might still struggle with the relative import
    # depending on how it's executed. Running the app via uvicorn from the project root
    # is the standard way: uvicorn api.api:app --reload
    print("Starting server with uvicorn. For development, run from project root: uvicorn api.api:app --reload")
    # Point uvicorn to the app object correctly for direct execution scenario
    uvicorn.run("api.api:app", host="0.0.0.0", port=8000, reload=True)
