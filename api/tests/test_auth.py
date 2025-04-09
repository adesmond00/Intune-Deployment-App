"""
Tests for the auth module that handles Microsoft Graph API authentication.
"""

import unittest
import os
import sys
import logging
from pathlib import Path

# Add the parent directory to sys.path to ensure imports work correctly
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

# Import the auth module
from api.functions.auth import get_auth_config, get_access_token, get_auth_headers

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TestGraphAuthentication(unittest.TestCase):
    """Test cases for Microsoft Graph API authentication"""
    
    def test_auth_config_loaded(self):
        """Test that auth configuration is properly loaded from environment variables"""
        config = get_auth_config()
        
        # Check that all required keys exist and have values
        self.assertIsNotNone(config.get("client_id"), "client_id should be loaded from environment")
        self.assertIsNotNone(config.get("client_secret"), "client_secret should be loaded from environment")
        self.assertIsNotNone(config.get("tenant_id"), "tenant_id should be loaded from environment")
        self.assertIsNotNone(config.get("authority"), "authority should be constructed correctly")
        
        # Verify that the authority URL is constructed correctly
        expected_authority = f"https://login.microsoftonline.com/{config['tenant_id']}"
        self.assertEqual(config["authority"], expected_authority, "Authority URL not constructed correctly")
    
    def test_get_access_token(self):
        """Test that we can successfully obtain an access token from Microsoft Graph API"""
        token = get_access_token()
        
        # The token should be a non-empty string if authentication was successful
        self.assertIsNotNone(token, "Access token should not be None")
        self.assertIsInstance(token, str, "Access token should be a string")
        self.assertTrue(len(token) > 0, "Access token should not be empty")
        
        logger.info("Successfully obtained access token")
    
    def test_get_auth_headers(self):
        """Test that auth headers are correctly constructed"""
        headers = get_auth_headers()
        
        # Headers should include Authorization with Bearer token
        self.assertIn("Authorization", headers, "Headers should include Authorization")
        self.assertTrue(headers["Authorization"].startswith("Bearer "), 
                        "Authorization header should start with 'Bearer '")
        
        # Headers should include Content-Type
        self.assertIn("Content-Type", headers, "Headers should include Content-Type")
        self.assertEqual(headers["Content-Type"], "application/json", 
                         "Content-Type should be 'application/json'")

if __name__ == "__main__":
    unittest.main()
