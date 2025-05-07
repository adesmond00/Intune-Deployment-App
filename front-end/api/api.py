# Update the imports section to include our new endpoint
from .app_library_endpoint import router as app_library_router

# Add this line after the other app.include_router calls
app.include_router(app_library_router)
