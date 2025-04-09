"""
End-to-end test for deploying a real application to Intune.

This test performs an actual deployment to Intune using the provided credentials
and the existing .intunewin file. It tests all arguments of the deploy_win32_app function.
"""

import os
import sys
import logging
import time
from typing import Dict, Any, List
import json

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add parent directory to path to import from api
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from api.functions.intune_deploy import deploy_win32_app
from api.functions.auth import get_access_token

def test_real_deployment():
    """
    Test deploying a real .intunewin file to Intune.
    Note: This test requires the environment variables to be set up correctly
    and expects the test .intunewin file to be available.
    """
    # Find the .intunewin file for testing
    test_file_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "files", "Winget-InstallPackage.intunewin"
    )
    
    # Ensure file exists
    if not os.path.exists(test_file_path):
        logger.error(f"Test .intunewin file not found at: {test_file_path}")
        return
    
    logger.info(f"Found .intunewin file at: {test_file_path}")
    logger.info(f"File size: {os.path.getsize(test_file_path)} bytes")
    
    # Define detection rules (required for Windows apps)
    detection_rules = [
        {
            "@odata.type": "microsoft.graph.win32LobAppFileSystemRule",
            "ruleType": "detection",
            "check32BitOn64System": False,
            "path": "C:\\Program Files\\WindowsApps",
            "fileOrFolderName": "winget.exe",
            "operationType": "exists",
            "operator": "equal",
            "comparisonValue": None
        }
    ]
    logger.info(f"Detection rules: {json.dumps(detection_rules, indent=2)}")
    
    # Define requirement rules (required for Windows apps)
    requirement_rules = [
        {
            "@odata.type": "microsoft.graph.win32LobAppRegistryRule",
            "ruleType": "requirement",
            "check32BitOn64System": False,
            "keyPath": "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion",
            "valueName": "CurrentBuildNumber",
            "operationType": "integer",
            "operator": "greaterThanOrEqual",
            "comparisonValue": "17763"
        }
    ]
    logger.info(f"Requirement rules: {json.dumps(requirement_rules, indent=2)}")
    
    # --- Application Details ---
    display_name = "Winget Installer Test"
    description = "Test deployment of Winget Installer via Intune"
    publisher = "Test Deployment"
    
    # --- Installation Details ---
    # Ensure these match the content INSIDE the .intunewin file
    setup_file_path = "Winget-InstallPackage.ps1" # CORRECTED based on user info
    install_command_line = f"powershell.exe -ExecutionPolicy Bypass -Command .\\{setup_file_path}" # CORRECTED
    uninstall_file_path = "Winget-UninstallPackage.ps1" # Assuming uninstall script name
    uninstall_command_line = f"powershell.exe -ExecutionPolicy Bypass -Command .\\{uninstall_file_path}" # CORRECTED
    
    # --- Platform Requirements ---
    minimum_os = "1607" # Example: Windows 10 version 1607
    architecture = "x64"
    
    # Log deployment parameters
    logger.info("Deploying with the following arguments:")
    logger.info(f"  display_name: {display_name}")
    logger.info(f"  description: {description}")
    logger.info(f"  publisher: {publisher}")
    logger.info(f"  install_command_line: {install_command_line}")
    logger.info(f"  uninstall_command_line: {uninstall_command_line}")
    logger.info(f"  intunewin_file_path: {test_file_path}")
    logger.info(f"  setup_file_path: {setup_file_path}")
    logger.info(f"  minimum_os: {minimum_os}")
    logger.info(f"  architecture: {architecture}")
    
    # Execute the deployment
    logger.info("Starting deployment to Intune...")
    result = deploy_win32_app(
        display_name=display_name,
        description=description,
        publisher=publisher,
        install_command_line=install_command_line,
        uninstall_command_line=uninstall_command_line,
        intunewin_file_path=test_file_path,
        setup_file_path=setup_file_path,  # Required parameter
        detection_rules=detection_rules,  # Required parameter
        requirement_rules=requirement_rules,  # Required parameter
        minimum_os=minimum_os,  # Windows 10 1607
        architecture=architecture
    )
    
    # Check the result
    if "error" in result:
        logger.error(f"Deployment failed: {result.get('error')}")
        if "details" in result:
            logger.error(f"Details: {result.get('details')}")
    else:
        logger.info(f"Deployment successful!")
        logger.info(f"App ID: {result.get('id')}")
        logger.info(f"Message: {result.get('message')}")

if __name__ == "__main__":
    # Explicitly check token acquisition first
    logger.info("--- Attempting initial authentication check ---")
    initial_token = get_access_token()
    if initial_token:
        logger.info("--- Initial authentication check SUCCESSFUL ---")
    else:
        logger.error("--- Initial authentication check FAILED. Check logs for errors from auth.py. Deployment may fail. ---")
    
    logger.info("--- Starting deployment test execution ---")
    test_real_deployment()
