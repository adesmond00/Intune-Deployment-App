"""
Intune Win32 App Deployment Module

This module provides functions to deploy Win32 applications to Microsoft Intune
using the Microsoft Graph API.
"""

import json
import base64
import logging
import time
import requests
import os
from typing import Dict, List, Optional, Union, Any, Tuple

# Import our authentication module
from .auth import get_auth_headers

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Graph API endpoints
GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"
GRAPH_API_ENDPOINT = f"{GRAPH_API_BASE}/deviceAppManagement/mobileApps"

class Win32AppRuleType:
    """Enum-like class for rule types"""
    DETECTION = "detection"
    REQUIREMENT = "requirement"

class Win32AppRegistryRuleOperationType:
    """Enum-like class for registry rule operation types"""
    EXISTS = "exists"
    STRING = "string"
    INTEGER = "integer"
    VERSION = "version"

class Win32AppRuleOperator:
    """Enum-like class for rule operators"""
    EQUAL = "equal"
    NOT_EQUAL = "notEqual"
    GREATER_THAN = "greaterThan"
    GREATER_EQUAL = "greaterThanOrEqual"
    LESS_THAN = "lessThan"
    LESS_EQUAL = "lessThanOrEqual"

def create_registry_rule(
    rule_type: str,
    key_path: str,
    value_name: Optional[str] = None,
    operation_type: str = "exists",
    operator: str = "equal",
    comparison_value: Optional[str] = None,
    check32_bit_on64_system: bool = False
) -> Dict[str, Any]:
    """
    Create a registry rule for Win32 app detection or requirement.
    
    Args:
        rule_type: Either "detection" or "requirement"
        key_path: Registry key path (e.g., "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows")
        value_name: Name of the registry value to check
        operation_type: Type of operation ("exists", "string", "integer", "version")
        operator: Comparison operator 
        comparison_value: Value to compare against
        check32_bit_on64_system: Whether to check 32-bit registry on 64-bit systems
    
    Returns:
        Dictionary representing a registry rule
    """
    return {
        "@odata.type": "microsoft.graph.win32LobAppRegistryRule",
        "ruleType": rule_type,
        "check32BitOn64System": check32_bit_on64_system,
        "keyPath": key_path,
        "valueName": value_name,
        "operationType": operation_type,
        "operator": operator,
        "comparisonValue": comparison_value
    }

def create_file_existence_rule(
    rule_type: str,
    path: str,
    file_or_folder_name: str,
    check32_bit_on64_system: bool = False,
    detection_type: str = "exists"
) -> Dict[str, Any]:
    """
    Create a file existence rule for Win32 app detection or requirement.
    
    Args:
        rule_type: Either "detection" or "requirement"
        path: Path to the directory to check
        file_or_folder_name: Name of the file or folder to check
        check32_bit_on64_system: Whether to check 32-bit paths on 64-bit systems
        detection_type: Type of detection ("exists" or "notExists")
    
    Returns:
        Dictionary representing a file existence rule
    """
    return {
        "@odata.type": "microsoft.graph.win32LobAppFileSystemRule",
        "ruleType": rule_type,
        "check32BitOn64System": check32_bit_on64_system,
        "path": path,
        "fileOrFolderName": file_or_folder_name,
        "operationType": detection_type,
        "operator": "equal",
        "comparisonValue": None
    }

def deploy_win32_app(
    display_name: str,
    description: str,
    publisher: str,
    install_command_line: str,
    uninstall_command_line: str,
    intunewin_file_path: str,
    setup_file_path: str,
    detection_rules: List[Dict[str, Any]],
    requirement_rules: List[Dict[str, Any]],
    minimum_os: str = "1607",
    architecture: str = "x64"
) -> Dict[str, Any]:
    """
    Deploy a Win32 application to Intune using Microsoft Graph API.
    
    Args:
        display_name: Display name of the application
        description: Description of the application
        publisher: Publisher of the application
        install_command_line: Command line to install the application
        uninstall_command_line: Command line to uninstall the application
        intunewin_file_path: Path to the .intunewin file
        setup_file_path: Path to the setup file within the .intunewin package
        detection_rules: List of detection rules (required)
        requirement_rules: List of requirement rules (required)
        minimum_os: Minimum supported Windows version (defaults to 1607)
        architecture: Architecture ("x86", "x64", "arm", "neutral") (defaults to x64)
    
    Returns:
        API response from Intune
    """
    # Log all input parameters for debugging
    logger.info(f"Deploying app with the following parameters:")
    logger.info(f"  display_name: {display_name}")
    logger.info(f"  description: {description}")
    logger.info(f"  publisher: {publisher}")
    logger.info(f"  install_command_line: {install_command_line}")
    logger.info(f"  uninstall_command_line: {uninstall_command_line}")
    logger.info(f"  intunewin_file_path: {intunewin_file_path}")
    logger.info(f"  setup_file_path: {setup_file_path}")
    logger.info(f"  detection_rules: {len(detection_rules)} rules provided")
    logger.info(f"  requirement_rules: {len(requirement_rules)} rules provided")
    logger.info(f"  minimum_os: {minimum_os}")
    logger.info(f"  architecture: {architecture}")
    
    # Get authorization headers using our auth module
    headers = get_auth_headers()
    if not headers:
        logger.error("Failed to get authorization headers")
        return {"error": "Authentication failed"}
    
    # Check if .intunewin file exists
    if not os.path.exists(intunewin_file_path):
        logger.error(f"Intunewin file not found: {intunewin_file_path}")
        return {"error": f"Intunewin file not found: {intunewin_file_path}"}
    
    # Check for required arguments
    if not detection_rules:
        logger.error("Detection rules are required")
        return {"error": "Detection rules are required for Win32 app deployment"}
    
    if not requirement_rules:
        logger.error("Requirement rules are required")
        return {"error": "Requirement rules are required for Win32 app deployment"}
    
    if not setup_file_path:
        logger.error("Setup file path is required")
        return {"error": "Setup file path is required for Win32 app deployment"}
    
    # Ensure all detection rules have the correct type
    for rule in detection_rules:
        if rule.get("ruleType") != Win32AppRuleType.DETECTION:
            rule["ruleType"] = Win32AppRuleType.DETECTION
    
    # Ensure all requirement rules have the correct type
    for rule in requirement_rules:
        if rule.get("ruleType") != Win32AppRuleType.REQUIREMENT:
            rule["ruleType"] = Win32AppRuleType.REQUIREMENT
    
    # Combine all rules
    rules = detection_rules + requirement_rules
    
    try:
        # Step 1: Create a mobile app with all required properties
        logger.info("Step 1: Creating mobile app...")
        
        app_body = {
            "@odata.type": "#microsoft.graph.win32LobApp",
            "displayName": display_name,
            "description": description,
            "publisher": publisher,
            "isFeatured": False,
            "fileName": os.path.basename(intunewin_file_path),
            "setupFilePath": setup_file_path,
            "installCommandLine": install_command_line,
            "uninstallCommandLine": uninstall_command_line,
            "rules": rules,
            "installExperience": {
                "@odata.type": "microsoft.graph.win32LobAppInstallExperience",
                "runAsAccount": "system",
                "deviceRestartBehavior": "basedOnReturnCode"
            },
            "returnCodes": [
                {
                    "@odata.type": "microsoft.graph.win32LobAppReturnCode",
                    "returnCode": 0,
                    "type": "success"
                },
                {
                    "@odata.type": "microsoft.graph.win32LobAppReturnCode",
                    "returnCode": 1641,
                    "type": "softReboot"
                },
                {
                    "@odata.type": "microsoft.graph.win32LobAppReturnCode",
                    "returnCode": 3010,
                    "type": "softReboot"
                },
                {
                    "@odata.type": "microsoft.graph.win32LobAppReturnCode",
                    "returnCode": 1603,
                    "type": "failed"
                }
            ],
            "minimumSupportedWindowsRelease": minimum_os,
            "applicableArchitectures": architecture
        }
        
        # Create the initial app with all properties
        app_response = requests.post(
            GRAPH_API_ENDPOINT,
            headers=headers,
            json=app_body
        )
        
        if app_response.status_code not in (200, 201):
            logger.error(f"Failed to create app: {app_response.status_code} - {app_response.text}")
            return {"error": "API error: {app_response.status_code}", "details": app_response.text}
        
        app_result = app_response.json()
        app_id = app_result.get("id")
        logger.info(f"Created mobile app with ID: {app_id}")
        
        # Wait for app to propagate in Intune
        logger.info("Waiting for app to propagate in Intune (5 seconds)...")
        import time
        time.sleep(5)  # Allow time for app propagation in Intune
        
        # Step 2: Create a content version for the app
        logger.info("Step 2: Creating content version...")
        content_version_result = create_content_version(headers, app_id)
        if "error" in content_version_result:
            return content_version_result
        
        content_version_id = content_version_result.get("id")
        logger.info(f"Created content version with ID: {content_version_id}")
        
        # Wait for content version to propagate in Intune
        logger.info("Waiting for content version to propagate (2 seconds)...")
        time.sleep(2)
        
        # Step 3: Get content upload URLs
        logger.info("Step 3: Getting content upload URLs...")
        file_size = os.path.getsize(intunewin_file_path)
        logger.info(f"Intunewin file size: {file_size} bytes")
        
        # Check if file is too small - warn but proceed
        if file_size < 5000:
            logger.warning(
                f"Warning: .intunewin file is very small ({file_size} bytes). "
                "Typical .intunewin files are much larger. This might not be a valid package."
            )
        
        upload_urls_result = get_content_upload_urls(headers, app_id, content_version_id, intunewin_file_path)
        if upload_urls_result.get("uploadState") == "azureStorageUriRequestPending":
            logger.info("Upload URL is not ready yet (azureStorageUriRequestPending). Polling for availability...")
            upload_urls_result = poll_for_upload_url(headers, app_id, content_version_id, upload_urls_result.get("files")[0].get("id"))
            if "error" in upload_urls_result:
                return upload_urls_result
        if "error" in upload_urls_result:
            return upload_urls_result
        
        # Step 4: Poll for the upload URL if needed
        if "files" in upload_urls_result and upload_urls_result["files"]:
            file_info = upload_urls_result["files"][0]
            if "uploadState" in file_info and file_info["uploadState"] == "azureStorageUriRequestPending":
                logger.info("Upload URL not immediately available. Starting polling process...")
                upload_urls_result = poll_for_upload_url(headers, app_id, content_version_id, file_info.get("id"))
                
                if "error" in upload_urls_result:
                    return upload_urls_result
        
        # Step 5: Upload the .intunewin file
        logger.info("Step 5: Uploading .intunewin file...")
        
        # Log the full response structure to understand what fields are available
        logger.info(f"Upload URLs response structure: {json.dumps(upload_urls_result, indent=2)}")
        
        # Try to extract the upload URL using different possible field names
        upload_url = None
        
        # Check if response contains the azureStorageUri
        if "azureStorageUri" in upload_urls_result and upload_urls_result["azureStorageUri"]:
            upload_url = upload_urls_result.get("azureStorageUri")
            logger.info(f"Found azureStorageUri: {upload_url}")
        # Check alternative field names that might be used
        elif "uploadUrl" in upload_urls_result and upload_urls_result["uploadUrl"]:
            upload_url = upload_urls_result.get("uploadUrl")
            logger.info(f"Found uploadUrl: {upload_url}")
        # Check if we have a files array with URLs
        elif "files" in upload_urls_result and upload_urls_result["files"]:
            logger.info(f"Found files array with {len(upload_urls_result['files'])} items")
            # Get the first file's upload URL
            first_file = upload_urls_result["files"][0]
            logger.info(f"First file keys: {list(first_file.keys())}")
            if "uploadUrl" in first_file and first_file["uploadUrl"]:
                upload_url = first_file.get("uploadUrl")
                logger.info(f"Found uploadUrl in files array: {upload_url}")
            elif "sasUrl" in first_file and first_file["sasUrl"]:
                upload_url = first_file.get("sasUrl")
                logger.info(f"Found sasUrl in files array: {upload_url}")
            elif "azureStorageUri" in first_file and first_file["azureStorageUri"]:
                upload_url = first_file.get("azureStorageUri")
                logger.info(f"Found azureStorageUri in files array: {upload_url}")
        
        # If we still don't have a URL, check for any URL-like string in the response
        if not upload_url:
            # Look for any field with 'url' in the name at top level
            for key, value in upload_urls_result.items():
                if "url" in key.lower() and isinstance(value, str) and value.startswith("http"):
                    upload_url = value
                    logger.info(f"Found URL in field {key}: {upload_url}")
                    break
            
            # Log the full final response JSON when the URL is missing despite success state
            logger.error(f"No valid upload URL found in response. Full response JSON: {json.dumps(upload_urls_result, indent=2)}")
            return {"error": "No upload URL found in the response"}
            
        logger.info(f"Final upload URL: {upload_url}")
        
        upload_result = upload_intunewin_file(upload_url, intunewin_file_path)
        if not upload_result:
            logger.error("File upload failed.")
            return {"error": "Failed to upload .intunewin file to Azure Storage"}
        
        logger.info("Successfully uploaded .intunewin file")
        
        # Wait after upload to ensure Intune processes the file
        logger.info("Waiting after file upload (10 seconds)...")
        time.sleep(10)
        
        # Step 6: Commit the content version
        logger.info("Step 6: Committing content version...")
        commit_result = commit_content_version(headers, app_id, content_version_id)
        if "error" in commit_result:
            return commit_result
        
        logger.info("Successfully committed content version")
        
        # Final step: Update the app with the committed content version ID
        logger.info("Final step: Updating app with content version ID...")
        update_url = f"{GRAPH_API_ENDPOINT}/deviceAppManagement/mobileApps/{app_id}"
        update_response = requests.patch(
            update_url,
            headers=headers,
            json={
                "committedContentVersion": content_version_id
            }
        )
        
        if update_response.status_code in (200, 201, 204):
            logger.info(f"Successfully deployed Win32 app: {display_name}")
            return {"id": app_id, "status": "success", "message": "App deployed successfully"}
        else:
            logger.error(f"Failed to update content version: {update_response.status_code} - {update_response.text}")
            return {
                "error": f"API error: {update_response.status_code}",
                "details": update_response.text
            }
    
    except Exception as e:
        logger.error(f"Exception during app deployment: {str(e)}")
        return {"error": str(e)}

def create_content_version(headers: Dict[str, str], app_id: str) -> Dict[str, Any]:
    """
    Create a content version for an app.
    
    Args:
        headers: Authorization headers
        app_id: ID of the application
    
    Returns:
        API response from content version creation
    """
    # Correct endpoint for creating content versions
    url = f"{GRAPH_API_ENDPOINT}/{app_id}/microsoft.graph.win32LobApp/contentVersions"
    
    logger.info(f"Creating content version with URL: {url}")
    
    try:
        # Create the content version
        response = requests.post(
            url,
            headers=headers,
            json={}
        )
        
        if response.status_code in (200, 201):
            return response.json()
        else:
            logger.error(f"Failed to create content version: {response.status_code} - {response.text}")
            return {
                "error": f"API error: {response.status_code}",
                "details": response.text
            }
    except Exception as e:
        logger.error(f"Exception during content version creation: {str(e)}")
        return {"error": str(e)}

def get_content_upload_urls(headers: Dict[str, str], app_id: str, content_version_id: str, intunewin_file_path: str) -> Dict[str, Any]:
    """
    Get the upload URLs for the content version.
    
    Args:
        headers: Authorization headers
        app_id: ID of the application
        content_version_id: ID of the content version
        intunewin_file_path: Path to the .intunewin file

    Returns:
        API response containing upload URLs or error
    """
    file_size = os.path.getsize(intunewin_file_path)
    logger.info(f"Intunewin file size: {file_size} bytes")
    
    # Warn if file size is very small
    if file_size < 10 * 1024: # Less than 10KB
        logger.warning(f"Warning: .intunewin file is very small ({file_size} bytes). "
                       "Typical .intunewin files are much larger. This might not be a valid package.")

    url = f"{GRAPH_API_ENDPOINT}/{app_id}/microsoft.graph.win32LobApp/contentVersions/{content_version_id}/files"
    payload = {
        "@odata.type": "#microsoft.graph.mobileAppContentFile",
        "name": os.path.basename(intunewin_file_path), # Use the actual filename
        "size": file_size,
        "sizeEncrypted": file_size, # Typically same as size unless pre-encrypted
        "manifest": None, # Let Intune generate this
        "isDependency": False
    }
    
    logger.info(f"Requesting upload URLs for content version {content_version_id}")
    logger.info(f"Request URL: {url}")
    
    try:
        # Initial POST to potentially create the file entry and get URLs
        response = requests.post(url, headers=headers, json=payload)
        
        if response.status_code in (200, 201): # Created or OK
            result = response.json()
            logger.info(f"Initial upload URL request response: {json.dumps(result, indent=2)}")
            
            # Check initial response structure for uploadState
            upload_state = result.get("uploadState", "unknown")
            logger.info(f"Initial uploadState: {upload_state}")

            # Check if URL is present immediately (unlikely but possible)
            upload_url = result.get("azureStorageUri") or result.get("uploadUrl")
            if upload_url:
                logger.info("Upload URL/Azure Storage URI available immediately.")
                return {"files": [result]} # Return as a list to match polling structure

            # If pending, start polling
            if upload_state == "azureStorageUriRequestPending":
                logger.info("Upload URL is pending, starting polling...")
                # Correctly get the file ID from the top-level result dictionary
                file_id = result.get("id")
                if not file_id:
                    logger.error("Could not find file ID in the initial response when polling was required.")
                    return {"error": "Missing file ID for polling."}
                
                poll_result = poll_for_upload_url(headers, app_id, content_version_id, file_id)
                
                # Check poll result for errors or the direct file dictionary
                if poll_result and "error" not in poll_result:
                    logger.info(f"Polling successful. Final file status: {json.dumps(poll_result, indent=2)}")
                    # Directly check the returned dictionary for the upload URI
                    final_upload_url = poll_result.get("azureStorageUri") or poll_result.get("uploadUrl")
                    
                    if final_upload_url:
                        logger.info("Successfully obtained upload URL/Azure Storage URI after polling.")
                        # Return the successful result, wrapped in the expected list structure
                        return {"files": [poll_result]}
                    else:
                        logger.error(f"Polling completed, but no upload URL or Azure Storage URI found in the final response (State: {poll_result.get('uploadState', 'N/A')}).")
                        return {"error": "No upload URL found after polling."}
                elif poll_result and "error" in poll_result:
                    # Handle errors returned by the polling function itself
                    logger.error(f"Polling failed: {poll_result['error']}")
                    return {"error": f"Polling failed: {poll_result['error']}"}
                else:
                    # Handle case where polling returns None or unexpected structure
                    logger.error("Polling function returned an unexpected result or None.")
                    return {"error": "Polling function returned unexpected result."}
            
            # Handle states other than pending from the initial response
            elif upload_state == "azureStorageUriRequestSuccess":
                 logger.error("Initial state is 'success' but URL was missing. This is unexpected.")
                 return {"error": "Initial state was success but URL was missing."}
            else:
                logger.error(f"Initial request returned unexpected upload state: {upload_state}")
                return {"error": f"Unexpected initial upload state: {upload_state}"}

        else:
            logger.error(f"Error requesting upload URLs: {response.status_code} - {response.text}")
            return {"error": f"API Error {response.status_code}: {response.text}"}
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Error requesting upload URLs: {e}")
        return {"error": str(e)}

def poll_for_upload_url(headers: Dict[str, str], app_id: str, content_version_id: str, file_id: str,
                       max_attempts: int = 60, delay_seconds: int = 6):
    """
    Poll for the upload URL until it's available or max attempts is reached.

    Args:
        headers: Authorization headers
        app_id: ID of the application
        content_version_id: ID of the content version
        file_id: ID of the file being polled
        max_attempts: Maximum number of polling attempts
        delay_seconds: Delay between polling attempts in seconds

    Returns:
        API response containing upload URLs when ready, or error if polling times out
    """
    file_status_url = f"{GRAPH_API_BASE}/deviceAppManagement/mobileApps/{app_id}/microsoft.graph.win32LobApp/contentVersions/{content_version_id}/files/{file_id}"
    logger.info(f"Polling file status URL: {file_status_url}")

    for attempt in range(max_attempts):
        logger.info(f"Polling attempt {attempt + 1}/{max_attempts} for upload URL...")
        try:
            file_status_response = requests.get(file_status_url, headers=headers)
            file_status_response.raise_for_status()  # Raise HTTPError for bad responses (4xx or 5xx)
        except requests.exceptions.RequestException as e:
            logger.error(f"Error polling for upload URL: {e}")
            # Allow retries for transient network issues
            time.sleep(delay_seconds)
            continue

        file_status_result = file_status_response.json()
        upload_state = file_status_result.get("uploadState")
        sas_uri = file_status_result.get("azureStorageUri")

        logger.debug(f"Polling attempt {attempt + 1}: State='{upload_state}', SAS URI Present={bool(sas_uri)}")

        # Primary check: Is the SAS URI available?
        if sas_uri:
            logger.info(f"Upload URL received (State: '{upload_state}'). Proceeding with upload.")
            # Even if URI is present, check if state indicates a potential issue needing attention
            if upload_state and upload_state.lower() == "commitfilepending":
                 logger.warning(f"SAS URI received, but state is '{upload_state}'. This might indicate a previous step was missed or is slow.")
            elif upload_state and upload_state.lower() == "error":
                 logger.error(f"SAS URI received, but state is '{upload_state}'. Error details: {file_status_result.get('errorMessage')}")
                 # Decide if you should return error or proceed despite the state
                 # return {"error": f"Polling failed with state: {upload_state}", "details": file_status_result.get('errorMessage')}
            return file_status_result  # Success
        elif upload_state and upload_state.lower() == "azureStorageUriRequestPending":
            logger.info(f"Attempt {attempt + 1}/{max_attempts}: Upload URL not ready yet (State: '{upload_state}'). Retrying in {delay_seconds} seconds...")
        elif upload_state and upload_state.lower() == "azureStorageUriRequestFailed":
            full_response_details = json.dumps(file_status_result, indent=2)
            logger.error(f"Polling attempt {attempt + 1}: Received 'azureStorageUriRequestFailed'. Aborting polling. Full response: \n{full_response_details}")
            return {"error": "azureStorageUriRequestFailed", "details": file_status_result}
        else: # Handle other unexpected states
            full_response_details = json.dumps(file_status_result, indent=2)
            logger.error(f"Polling attempt {attempt + 1}: Unexpected state '{upload_state}'. Full response: \n{full_response_details}\nRetrying...")

        time.sleep(delay_seconds)

    logger.error(f"Failed to get upload URL after {max_attempts} attempts.")
    return {"error": f"Polling timed out after {max_attempts * delay_seconds} seconds"}

def upload_intunewin_file(upload_url: str, intunewin_file_path: str):
    """
    Upload the .intunewin file to the provided Azure Storage URL.
    
    Args:
        upload_url: The SAS URL provided by Intune
        intunewin_file_path: Path to the .intunewin file

    Returns:
        True if upload is successful, False otherwise
    """
    logger.info(f"Uploading .intunewin file: {intunewin_file_path}")
    try:
        with open(intunewin_file_path, 'rb') as file_contents:
            file_size = os.path.getsize(intunewin_file_path)
            logger.info(f"File size: {file_size} bytes")
            
            # Headers required for Azure Blob Storage SAS URL upload
            headers = {
                'Content-Length': str(file_size),
                'x-ms-blob-type': 'BlockBlob'
                # 'Content-Type': 'application/octet-stream' # Often not needed for SAS PUT
            }
            logger.info(f"Uploading to URL: {upload_url}")
            
            response = requests.put(upload_url, headers=headers, data=file_contents)
            
            logger.info(f"Upload response status code: {response.status_code}")
            if response.status_code in (200, 201): # OK or Created
                logger.info("Successfully uploaded .intunewin file.")
                return True
            else:
                logger.error(f"Error uploading file: {response.status_code} - {response.text}")
                return False
                
    except requests.exceptions.RequestException as e:
        logger.error(f"Exception during file upload: {e}")
        return False
    except FileNotFoundError:
        logger.error(f"Error: .intunewin file not found at {intunewin_file_path}")
        return False
    except Exception as e:
        logger.error(f"An unexpected error occurred during upload: {e}")
        return False

def commit_content_version(headers: Dict[str, str], app_id: str, content_version_id: str):
    """
    Commit the content version after file upload.
    """
    # Correct URL path including /deviceAppManagement/mobileApps/
    url = (f"{GRAPH_API_ENDPOINT}/deviceAppManagement/mobileApps/{app_id}/microsoft.graph.win32LobApp/contentVersions/"
           f"{content_version_id}/commit")
    
    # For unencrypted files, fileEncryptionInfo should be null
    body = {
        "fileEncryptionInfo": None
    }
    
    # Log request details for debugging
    log_headers = {k: v for k, v in headers.items() if k.lower() != 'authorization'}
    logger.debug(f"Commit Request URL: {url}")
    logger.debug(f"Commit Request Headers: {log_headers}")
    logger.debug(f"Commit Request Body: {json.dumps(body)}")
    
    try:
        response = requests.post(
            url,
            headers=headers,
            json=body
        )
        
        if response.status_code in (200, 201, 204):
            return {"status": "success", "contentVersionId": content_version_id}
        else:
            logger.error(f"Failed to commit content version: {response.status_code} - {response.text}")
            return {
                "error": f"API error: {response.status_code}",
                "details": response.text
            }
    except Exception as e:
        logger.error(f"Exception during content commit: {str(e)}")
        return {"error": str(e)}

def create_common_detection_rules(install_path: str, executable_name: str) -> List[Dict[str, Any]]:
    """
    Create common detection rules based on executable presence.
    
    Args:
        install_path: The installation path of the application
        executable_name: The name of the main executable file
    
    Returns:
        List of detection rules
    """
    return [
        create_file_existence_rule(
            rule_type=Win32AppRuleType.DETECTION,
            path=install_path,
            file_or_folder_name=executable_name
        )
    ]

# Example usage:
"""
# Create detection rules
detection_rules = [
    create_file_existence_rule(
        rule_type=Win32AppRuleType.DETECTION,
        path="C:\\Program Files\\MyApp",
        file_or_folder_name="myapp.exe"
    )
]

# Create requirement rules
requirement_rules = [
    create_registry_rule(
        rule_type=Win32AppRuleType.REQUIREMENT,
        key_path="HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion",
        value_name="CurrentBuild",
        operation_type="integer",
        operator=Win32AppRuleOperator.GREATER_EQUAL,
        comparison_value="17763"
    )
]

# Deploy the application
result = deploy_win32_app(
    display_name="My Application",
    description="My awesome application",
    publisher="My Company",
    install_command_line="setup.exe /quiet",
    uninstall_command_line="setup.exe /uninstall /quiet",
    intunewin_file_path="/path/to/myapp.intunewin",
    setup_file_path="setup.exe",
    detection_rules=detection_rules,
    requirement_rules=requirement_rules
)

print(result)
"""
