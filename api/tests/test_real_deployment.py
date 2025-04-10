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
import zipfile

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(name)s:%(message)s')
logger = logging.getLogger(__name__)

# Set the specific logger for intune_deploy to DEBUG level
intune_deploy_logger = logging.getLogger('api.functions.intune_deploy')
intune_deploy_logger.setLevel(logging.DEBUG)

# Add parent directory to path to import from api
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from api.functions.intune_deploy import deploy_win32_app
from api.functions.auth import get_access_token, get_auth_headers

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
    
    # --- Inspect detection.xml --- 
    logger.info("--- Inspecting detection.xml --- ")
    detection_xml_path_in_zip = "IntuneWinPackage/Metadata/Detection.xml"
    try:
        with zipfile.ZipFile(test_file_path, 'r') as archive:
            if detection_xml_path_in_zip in archive.namelist():
                with archive.open(detection_xml_path_in_zip) as xml_file:
                    xml_content = xml_file.read().decode('utf-8')
                    logger.info(f"Content of {detection_xml_path_in_zip}:\n{xml_content}")
            else:
                logger.error(f"{detection_xml_path_in_zip} not found in the archive.")
    except Exception as e:
        logger.error(f"Error inspecting detection.xml: {e}")
    logger.info("--- Finished inspecting detection.xml --- ")
    # ------------------------------

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
    if isinstance(result, str) and result: # Success case: returns app_id string
        logger.info(f"Deployment successful! App ID: {result}")
    elif isinstance(result, tuple) and len(result) == 2 and result[0] is False:
        # Failure case: returns (False, details_dict)
        _, details = result
        logger.error("Deployment failed.")
        if details and isinstance(details, dict):
            logger.error(f"Details: {details}")
        else:
            logger.error("Deployment failed with incomplete details returned.")
    elif result is False:
        # Failure case: returns simple False (e.g., pre-polling error)
        logger.error("Deployment failed (returned False).")
    else:
        # Unexpected return type
        logger.error(f"Deployment failed with unexpected return value: {result}")
 
    logger.info("--- Deployment test finished ---")

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
