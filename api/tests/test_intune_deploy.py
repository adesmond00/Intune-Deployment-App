"""
Tests for the intune_deploy module that handles Win32 application deployment to Intune.
"""

import unittest
import os
import sys
import json
import tempfile
import logging
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add the parent directory to sys.path to ensure imports work correctly
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

# Import the intune_deploy module
from api.functions.intune_deploy import (
    deploy_win32_app, 
    create_registry_rule,
    create_file_existence_rule,
    Win32AppRuleType
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TestIntuneDeployment(unittest.TestCase):
    """Test cases for Intune Win32 app deployment"""
    
    def setUp(self):
        """Set up test fixtures"""
        # Create a temporary .intunewin file for testing
        self.temp_intunewin = tempfile.NamedTemporaryFile(suffix='.intunewin', delete=False)
        self.temp_intunewin.write(b'This is a mock .intunewin file for testing')
        self.temp_intunewin.close()
        
        # Create sample detection rules
        self.detection_rules = [
            create_file_existence_rule(
                rule_type=Win32AppRuleType.DETECTION,
                path="C:\\Program Files\\TestApp",
                file_or_folder_name="testapp.exe"
            )
        ]
        
        # Create sample requirement rules
        self.requirement_rules = [
            create_registry_rule(
                rule_type=Win32AppRuleType.REQUIREMENT,
                key_path="HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion",
                value_name="CurrentBuild",
                operation_type="integer",
                operator="greaterThanOrEqual",
                comparison_value="17763"
            )
        ]
    
    def tearDown(self):
        """Clean up test fixtures"""
        # Remove the temporary .intunewin file
        if os.path.exists(self.temp_intunewin.name):
            os.unlink(self.temp_intunewin.name)
    
    @patch('api.functions.intune_deploy.create_mobile_app')
    def test_deploy_win32_app_creation(self, mock_create_app):
        """Test initial app creation step of the deployment process"""
        # Mock the response for create_mobile_app
        mock_app_id = "12345678-1234-1234-1234-123456789012"
        mock_create_app.return_value = {"id": mock_app_id, "displayName": "Test App"}
        
        # Other required mocks to prevent actual API calls in later steps
        with patch('api.functions.intune_deploy.create_content_version') as mock_create_version, \
             patch('api.functions.intune_deploy.get_content_upload_urls') as mock_get_urls, \
             patch('api.functions.intune_deploy.upload_intunewin_file') as mock_upload, \
             patch('api.functions.intune_deploy.commit_content_version') as mock_commit, \
             patch('api.functions.intune_deploy.requests.patch') as mock_patch:
            
            # Setup mock return values to avoid errors
            mock_create_version.return_value = {"id": "version-123"}
            mock_get_urls.return_value = {"uploadUrl": "https://example.com/upload", "contentVersion": "version-123"}
            mock_upload.return_value = {"status": "success", "contentVersion": "version-123"}
            mock_commit.return_value = {"status": "success", "contentVersionId": "version-123"}
            
            # Mock the final PATCH response
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_patch.return_value = mock_response
            
            # Call the deploy function
            result = deploy_win32_app(
                display_name="Test Application",
                description="Test application for unit tests",
                publisher="Test Publisher",
                install_command_line="setup.exe /quiet",
                uninstall_command_line="setup.exe /uninstall /quiet",
                intunewin_file_path=self.temp_intunewin.name,
                setup_file_path="setup.exe",
                detection_rules=self.detection_rules,
                requirement_rules=self.requirement_rules
            )
            
            # Check that the app creation function was called with correct parameters
            mock_create_app.assert_called_once()
            args, kwargs = mock_create_app.call_args
            headers = kwargs.get('headers', args[0] if args else None)
            display_name = kwargs.get('display_name', args[1] if len(args) > 1 else None)
            description = kwargs.get('description', args[2] if len(args) > 2 else None)
            publisher = kwargs.get('publisher', args[3] if len(args) > 3 else None)
            
            # Verify the result
            self.assertIsInstance(result, dict)
            self.assertIn("status", result)
            self.assertEqual(result["status"], "success")
            
            # Test was successful if we get here without exceptions
            logger.info("Successfully tested Win32 app deployment flow")

    def test_create_registry_rule(self):
        """Test creating a registry rule"""
        rule = create_registry_rule(
            rule_type=Win32AppRuleType.REQUIREMENT,
            key_path="HKEY_LOCAL_MACHINE\\SOFTWARE\\Test",
            value_name="Version",
            operation_type="string",
            operator="equal",
            comparison_value="1.0"
        )
        
        # Verify the rule structure
        self.assertEqual(rule["@odata.type"], "microsoft.graph.win32LobAppRegistryRule")
        self.assertEqual(rule["ruleType"], "requirement")
        self.assertEqual(rule["keyPath"], "HKEY_LOCAL_MACHINE\\SOFTWARE\\Test")
        self.assertEqual(rule["valueName"], "Version")
        self.assertEqual(rule["operationType"], "string")
        self.assertEqual(rule["operator"], "equal")
        self.assertEqual(rule["comparisonValue"], "1.0")
    
    def test_create_file_existence_rule(self):
        """Test creating a file existence rule"""
        rule = create_file_existence_rule(
            rule_type=Win32AppRuleType.DETECTION,
            path="C:\\Program Files\\App",
            file_or_folder_name="app.exe"
        )
        
        # Verify the rule structure
        self.assertEqual(rule["@odata.type"], "microsoft.graph.win32LobAppFileSystemRule")
        self.assertEqual(rule["ruleType"], "detection")
        self.assertEqual(rule["path"], "C:\\Program Files\\App")
        self.assertEqual(rule["fileOrFolderName"], "app.exe")
        self.assertEqual(rule["operationType"], "exists")

    @patch('api.functions.intune_deploy.create_mobile_app')
    def test_deploy_with_winget_package(self, mock_create_app):
        """Test deployment with actual Winget package ensuring proper file paths"""
        # Find the actual .intunewin file path that was just pulled
        intunewin_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "aWinget-InstallPackage.intunewin"
        )
        
        # Skip test if file doesn't exist
        if not os.path.exists(intunewin_path):
            self.skipTest(f"Test .intunewin file not found at: {intunewin_path}")
        
        logger.info(f"Testing with .intunewin file: {intunewin_path}")
        
        # Mock the response for create_mobile_app
        mock_app_id = "12345678-1234-1234-1234-123456789012"
        mock_create_app.return_value = {"id": mock_app_id, "displayName": "Winget Installer"}
        
        # Create proper detection rules
        detection_rules = [
            create_file_existence_rule(
                rule_type=Win32AppRuleType.DETECTION,
                path="C:\\Program Files\\WindowsApps",
                file_or_folder_name="winget.exe"
            )
        ]
        
        # Create proper requirement rules
        requirement_rules = [
            create_registry_rule(
                rule_type=Win32AppRuleType.REQUIREMENT,
                key_path="HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion",
                value_name="CurrentBuildNumber",
                operation_type="integer",
                operator="greaterThanOrEqual",
                comparison_value="17763"
            )
        ]
        
        # Set proper setup file path and command lines
        setup_file_path = "Winget-InstallPackage.ps1"  # Matches actual script name
        install_command_line = f"powershell.exe -ExecutionPolicy Bypass -Command .\\{setup_file_path}"
        uninstall_command_line = "powershell.exe -ExecutionPolicy Bypass -Command .\\Winget-UninstallPackage.ps1"
        
        # Other required mocks to prevent actual API calls
        with patch('api.functions.intune_deploy.create_content_version') as mock_create_version, \
             patch('api.functions.intune_deploy.get_content_upload_urls') as mock_get_urls, \
             patch('api.functions.intune_deploy.upload_intunewin_file') as mock_upload, \
             patch('api.functions.intune_deploy.commit_content_version') as mock_commit, \
             patch('api.functions.intune_deploy.requests.patch') as mock_patch:
            
            # Setup mock return values
            mock_create_version.return_value = {"id": "version-123"}
            mock_get_urls.return_value = {"uploadUrl": "https://example.com/upload", "contentVersion": "version-123"}
            mock_upload.return_value = True  # Make sure this matches what upload_intunewin_file returns
            mock_commit.return_value = {"status": "success", "contentVersionId": "version-123"}
            
            # Mock the final PATCH response
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_patch.return_value = mock_response
            
            # Call the deploy function with correct parameters
            result = deploy_win32_app(
                display_name="Winget Installer Test",
                description="Test deployment of Winget Installer",
                publisher="Test Publisher",
                install_command_line=install_command_line,
                uninstall_command_line=uninstall_command_line,
                intunewin_file_path=intunewin_path,
                setup_file_path=setup_file_path,  # This should match the script name in the .intunewin file
                detection_rules=detection_rules,
                requirement_rules=requirement_rules
            )
            
            # Verify parameters passed to create_mobile_app
            mock_create_app.assert_called_once()
            
            # Make sure setupFilePath in the app creation matches our intended script name
            args, kwargs = mock_create_app.call_args
            app_body = kwargs.get('app_body', None)
            if app_body:
                self.assertEqual(app_body.get('setupFilePath', None), setup_file_path)
            
            # Verify the result
            self.assertIsInstance(result, dict)
            self.assertIn("status", result)
            self.assertEqual(result["status"], "success")
            
            logger.info("Successfully tested Winget package deployment")

if __name__ == "__main__":
    unittest.main()
