from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from api.functions.winget import search_package

app = FastAPI(title="Intune Deployment API")

class SearchRequest(BaseModel):
    search_term: str

@app.get("/")
async def root():
    return {"message": "Welcome to the Intune Deployment API"}

@app.post("/search")
async def search_applications(request: SearchRequest):
    """
    Search for applications using winget
    """
    result = search_package(request.search_term)
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
