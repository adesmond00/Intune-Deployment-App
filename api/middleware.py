"""
Middleware Configuration for the FastAPI Application
"""

from fastapi.middleware.cors import CORSMiddleware

# --- CORS Middleware Configuration ---
# WARNING: The current configuration is highly permissive (allows all origins, methods, headers)
# and is suitable ONLY for local development where the API is isolated.
#
# !!! IMPORTANT FOR PRODUCTION !!!
# Before deploying to a production environment, you MUST restrict `allow_origins`.
# Replace `["*"]` with a list containing the specific domain(s) of your frontend application.
# Example: origins = ["https://your-frontend-domain.com", "https://another-frontend.com"]
# Consider also restricting `allow_methods` and `allow_headers` if appropriate for security.

development_origins = ["*"] # Allows all origins - DEVELOPMENT ONLY

# Production example (keep commented out for development)
# production_origins = [
#     "https://your-production-frontend-domain.com",
# ]

cors_middleware_config = {
    "middleware_class": CORSMiddleware,
    "allow_origins": development_origins, # Use the permissive list for now
    "allow_credentials": True, # Allows cookies/auth headers (set to False if not needed)
    "allow_methods": ["*"],    # Allows all HTTP methods (GET, POST, etc.)
    "allow_headers": ["*"],    # Allows all HTTP headers
}

# You could also define a function that returns the configured middleware if more complex setup is needed later.
