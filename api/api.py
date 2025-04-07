from fastapi import FastAPI, HTTPException
from typing import Optional, List, Dict
# Use relative import since api.py is inside the 'api' directory
from .functions.winget import search_package

app = FastAPI(title="Intune Deployment API")

@app.get("/")
async def root():
    return {"message": "Welcome to the Intune Deployment API"}

@app.get("/search", response_model=List[Dict[str, str]])
async def search_applications_json(search_term: str):
    """
    Search for applications using winget and return structured JSON data.
    Pass the search term as a query parameter, e.g., /search-json?search_term=vscode
    
    Returns a list of applications with Name, Id, Version, and Source fields.
    """
    result = search_package(search_term)
    
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("error") or result.get("message", "Unknown error during winget search"))
    
    # Parse the output to extract structured data
    raw_output = result.get("output", "")
    apps = []
    
    # Skip processing if output is empty
    if not raw_output:
        return []
    
    lines = raw_output.split('\n')
    
    # Find the header line (contains "Name", "Id", "Version", "Source")
    header_index = -1
    for i, line in enumerate(lines):
        if "Name" in line and "Id" in line and "Version" in line and "Source" in line:
            header_index = i
            break
    
    if header_index == -1 or header_index + 2 >= len(lines):
        # No header found or not enough lines after header
        return []
    
    # Skip the header and separator line
    for line in lines[header_index + 2:]:
        # Skip empty lines
        if not line.strip():
            continue
            
        # Try to parse the line into columns
        # The format might be variable width columns, so we need to be careful
        parts = line.split()
        if len(parts) < 4:
            continue
            
        # The last part is Source
        source = parts[-1]
        # Version is typically the third-last part
        version = parts[-3] if len(parts) >= 3 else ""
        # Id is typically multiple parts in the middle
        # We need to find where Name ends and Id begins
        
        # First, join all parts except the last 3 (Version, Match, Source)
        remaining = " ".join(parts[:-3])
        # Then try to split it into Name and Id based on multiple spaces
        import re
        name_id_parts = re.split(r'\s{2,}', remaining)
        
        if len(name_id_parts) >= 2:
            name = name_id_parts[0]
            id = name_id_parts[1]
        else:
            # If we couldn't split cleanly, take a best guess
            name_end = min(30, len(remaining))
            name = remaining[:name_end].strip()
            id = remaining[name_end:].strip()
        
        apps.append({
            "Name": name,
            "Id": id,
            "Version": version,
            "Source": source
        })
    
    return apps

if __name__ == "__main__":
    import uvicorn
    # When running api.py directly, Python might still struggle with the relative import
    # depending on how it's executed. Running the app via uvicorn from the project root
    # is the standard way: uvicorn api.api:app --reload
    print("Starting server with uvicorn. For development, run from project root: uvicorn api.api:app --reload")
    # Point uvicorn to the app object correctly for direct execution scenario
    uvicorn.run("api.api:app", host="0.0.0.0", port=8000, reload=True)
