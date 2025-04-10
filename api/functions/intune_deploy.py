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
import zipfile
import xml.etree.ElementTree as ET
from typing import Dict, List, Any, Optional
import math
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.padding import PKCS7
from cryptography.hazmat.backends import default_backend
import hashlib
import hmac

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
        encryption_info_dict = extract_file_encryption_info(intunewin_file_path)
        if not encryption_info_dict:
            return {'error': "Failed to extract encryption info from .intunewin file.", 'app_id': app_id}
        expected_unencrypted_size = encryption_info_dict.get('UnencryptedContentSize')
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
        upload_urls_result = get_content_upload_urls(headers, app_id, content_version_id, intunewin_file_path)

        # Check for errors first
        if "error" in upload_urls_result:
            logger.error(f"Failed to get upload URLs: {upload_urls_result['error']}")
            return upload_urls_result

        # Extract URL and file ID
        upload_url = upload_urls_result.get("upload_url")
        file_id = upload_urls_result.get("file_id")

        if not upload_url or not file_id:
            logger.error("Missing upload_url or file_id in the response from get_content_upload_urls.")
            details = upload_urls_result.get("details", "No additional details provided.") # Provide details if possible
            return {"error": "Missing upload URL or file ID.", "details": details}

        logger.info(f"Successfully obtained upload URL and file ID: {file_id}")
        
        # Step 3.5: Extract File Encryption Info from .intunewin
        logger.info("Extracting file encryption info...")
        file_encryption_info = extract_file_encryption_info(intunewin_file_path)
        if not file_encryption_info:
            logger.error("Failed to extract file encryption info. Aborting deployment.")
            # Consider cleanup: delete the created app/content version? (Potentially complex)
            return {"error": "Failed to extract fileEncryptionInfo"}

        expected_unencrypted_size_str = file_encryption_info.get('UnencryptedContentSize')
        if not expected_unencrypted_size_str:
            logger.error("UnencryptedContentSize not found in encryption info. Aborting.")
            return {"error": "Missing UnencryptedContentSize in fileEncryptionInfo"}
        try:
            expected_unencrypted_size = int(expected_unencrypted_size_str)
        except ValueError:
            logger.error(f"Invalid UnencryptedContentSize: {expected_unencrypted_size_str}. Aborting.")
            return {"error": "Invalid UnencryptedContentSize in fileEncryptionInfo"}

        # Step 4: Decrypt locally and upload file chunks
        logger.info("Step 4: Decrypting locally and uploading file chunks...")
        upload_success, calculated_digest = _decrypt_and_upload_chunks(
            intunewin_file_path,
            file_encryption_info, # Pass the extracted info
            upload_url,
            expected_unencrypted_size # Pass the expected size
        )

        if not upload_success:
            logger.error("Decryption, size verification, or upload process failed. Aborting deployment.")
            # Consider cleanup: delete the created app/content version?
            return {"error": "Decryption/size check/upload failed"}

        logger.info("File chunks uploaded successfully.")

        # Step 5: Commit the content version file
        logger.info("Step 5: Committing the content version file...")
        commit_result = commit_content_version(headers, app_id, content_version_id, file_id, file_encryption_info, calculated_digest, expected_unencrypted_size)
        if commit_result.get('status') != 'success':
            logger.error(f"Failed to commit content version file: {commit_result.get('error', 'Unknown error')}")
            # Consider cleanup
            return {"error": f"Failed to commit file: {commit_result.get('error', 'Unknown error')}"}

        logger.info("Content version file committed successfully. Polling for commit status...")
        # Step 5.5: Poll for commit status
        final_file_status = poll_for_commit_status(headers, app_id, content_version_id, file_id)
        if 'error' in final_file_status or final_file_status.get('uploadState') != 'commitFileSuccess':
            err_msg = final_file_status.get('error', f"Final upload state was not commitFileSuccess: {final_file_status.get('uploadState')}")
            logger.error(f"File commit failed or timed out: {err_msg}")
            return {"error": f"File commit failed or timed out: {err_msg}"}

        logger.info("File commit successful.")

        # Step 6: Update the app with final details (Install/Uninstall commands, rules, etc.)
        logger.info("Step 6: Updating the app with final details...")
        # Correct URL: Targets the specific app object for PATCH
        update_url = f"{GRAPH_API_ENDPOINT}/{app_id}" 
        update_payload = {
            "@odata.type": "#microsoft.graph.win32LobApp", # Add odata type hint for PATCH
            "committedContentVersion": content_version_id
        }
        logger.info(f"Final app update URL: {update_url}")
        logger.info(f"Final app update payload: {json.dumps(update_payload, indent=2)}")

        update_response = requests.patch(
            update_url,
            headers=headers,
            json=update_payload
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
        Dictionary containing 'upload_url' and 'file_id' on success, or {'error': ...} on failure.
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
            file_id = result.get("id") # Get file_id here

            # Check if URL is present immediately (unlikely but possible)
            upload_url = result.get("azureStorageUri") or result.get("uploadUrl")
            if upload_url:
                logger.info("Upload URL/Azure Storage URI available immediately.")
                if not file_id:
                    logger.error("URL found immediately, but file ID is missing.")
                    return {"error": "Missing file ID on immediate success."}
                return {"upload_url": upload_url, "file_id": file_id}

            # If pending, start polling
            if upload_state == "azureStorageUriRequestPending":
                logger.info("Upload URL is pending, starting polling...")
                if not file_id:
                    logger.error("Could not find file ID in the initial response when polling was required.")
                    return {"error": "Missing file ID for polling."}
                
                poll_result = poll_for_upload_url(headers, app_id, content_version_id, file_id)
                
                # Check poll result for errors or the direct file dictionary
                if poll_result and "error" not in poll_result:
                    logger.info(f"Polling successful. Final file status: {json.dumps(poll_result, indent=2)}")
                    # Directly check the returned dictionary for the upload URI and file ID
                    final_upload_url = poll_result.get("azureStorageUri") or poll_result.get("uploadUrl")
                    final_file_id = poll_result.get("id") # Should match the file_id we polled with
                    
                    if final_upload_url and final_file_id:
                        logger.info("Successfully obtained upload URL/Azure Storage URI and file ID after polling.")
                        return {"upload_url": final_upload_url, "file_id": final_file_id}
                    elif not final_upload_url:
                        logger.error(f"Polling completed, but no upload URL or Azure Storage URI found in the final response (State: {poll_result.get('uploadState', 'N/A')}).")
                        return {"error": "No upload URL found after polling."}
                    else: # URL found but ID missing (highly unlikely)
                         logger.error(f"Polling completed and URL found, but file ID missing in final response (State: {poll_result.get('uploadState', 'N/A')}).")
                         return {"error": "Missing file ID after polling."}
                elif poll_result and "error" in poll_result:
                    # Handle errors returned by the polling function itself
                    logger.error(f"Polling failed: {poll_result['error']}")
                    return poll_result
                else:
                    logger.error("Polling function returned an unexpected result or None.")
                    return {"error": "Polling function returned unexpected result."}
            
            # Handle states other than pending from the initial response
            elif upload_state == "azureStorageUriRequestSuccess":
                 # This case means initial POST returned success state but we didn't find URL/ID earlier
                 logger.error("Initial state is 'success' but URL or file ID was missing. This is unexpected.")
                 return {"error": "Initial state was success but URL or file ID was missing."}
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

def commit_content_version(headers: Dict[str, str], app_id: str, content_version_id: str, file_id: str, file_encryption_info_dict: Dict[str, Any], calculated_digest: str, unencrypted_size: int):
    """
    Commit the content version file after upload using its specific file ID.
    
    Args:
        headers: Authorization headers
        app_id: ID of the application
        content_version_id: ID of the content version
        file_id: ID of the specific file within the content version
        file_encryption_info_dict: Dictionary containing the fileEncryptionInfo structure (PascalCase keys from extraction)
        calculated_digest: The SHA256 digest calculated from the decrypted uploaded content.
        unencrypted_size: The expected unencrypted content size from detection.xml.
        
    Returns:
        Dictionary with status or error details
    """
    commit_url = f"{GRAPH_API_ENDPOINT}/{app_id}/microsoft.graph.win32LobApp/contentVersions/{content_version_id}/files/{file_id}/commit"
    logger.info(f"Commit Request URL: {commit_url}")
    
    # Convert PascalCase keys from extraction to camelCase for Graph API
    file_encryption_info_camel = {}
    for key, value in file_encryption_info_dict.items():
        if key and value is not None: # Ensure key and value are not None
            camel_key = key[0].lower() + key[1:]
            file_encryption_info_camel[camel_key] = value

    # Use the calculated digest from the actual upload, not the one from XML
    if calculated_digest:
        file_encryption_info_camel['fileDigest'] = calculated_digest
        logger.info(f"Using calculated fileDigest for commit: {calculated_digest}")

    # Remove fields potentially causing 400 Bad Request, aiming for 202 Accepted + successful async processing
    file_encryption_info_camel.pop('unencryptedContentSize', None)
    file_encryption_info_camel.pop('@odata.type', None) # This key might not even exist if conversion failed, hence .pop

    # Add the unencrypted size and use the calculated digest *within* the nested object
    file_encryption_info_camel['unencryptedContentSize'] = unencrypted_size

    commit_payload = {
        "fileEncryptionInfo": file_encryption_info_camel
    }
    
    # Manually serialize the payload and set content-type header
    commit_payload_json = json.dumps(commit_payload)
    commit_headers = headers.copy() # Avoid modifying the original headers dict
    commit_headers['Content-Type'] = 'application/json; charset=utf-8'

    # Use json.dumps for pretty printing the body for logging
    logger.info("Commit Request Body:")
    try:
        logger.info(json.dumps(commit_payload, indent=2))
    except TypeError:
        logger.info(str(commit_payload)) # Fallback if not JSON serializable for logging

    # Ensure correct Content-Type header
    logger.debug(f"Commit Request Headers: {commit_headers}")

    try:
        response = requests.post(commit_url, headers=commit_headers, data=commit_payload_json)
        response.raise_for_status()  # Raise HTTPError for bad responses (4xx or 5xx)
        logger.info(f"Commit request for file {file_id} sent successfully.")
        # A successful POST to commit doesn't return content but indicates the process started
        return {'status': 'success'}
    except requests.exceptions.RequestException as e:
        error_message = f"API error: {e.response.status_code}" if e.response else f"Request failed: {e}"
        response_text = e.response.text if e.response else "No response body"
        logger.error(f"Failed to commit file {file_id}: {error_message} - {response_text}")
        return {'status': 'error', 'error': f"{error_message}"}
    except Exception as e:
        logger.error(f"An unexpected error occurred during commit: {e}", exc_info=True)
        return {'status': 'error', 'error': f"Unexpected error: {e}"}

def poll_for_commit_status(headers: Dict[str, str], app_id: str, content_version_id: str, file_id: str,
                           max_attempts: int = 60, delay_seconds: int = 10):
    """
    Poll for the commit status of a content version file until it's successful or max attempts reached.

    Args:
        headers: Authorization headers
        app_id: ID of the application
        content_version_id: ID of the content version
        file_id: ID of the file being polled
        max_attempts: Maximum number of polling attempts
        delay_seconds: Delay between polling attempts in seconds

    Returns:
        The final file status dictionary on success, or {'error': ...} on failure/timeout.
    """
    url = (f"{GRAPH_API_ENDPOINT}/{app_id}/microsoft.graph.win32LobApp/contentVersions/"
           f"{content_version_id}/files/{file_id}")
    logger.info(f"Polling commit status for file {file_id} at URL: {url}")

    for attempt in range(max_attempts):
        logger.info(f"Commit polling attempt {attempt + 1}/{max_attempts}...")
        try:
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200:
                file_status_result = response.json()
                upload_state = file_status_result.get("uploadState", "unknown")
                logger.info(f"Current commit uploadState: {upload_state}")

                if upload_state == "commitFileSuccess":
                    logger.info(f"Commit successful for file {file_id}.")
                    return file_status_result # Return the full status on success
                elif upload_state in ["failed", "commitFileFailed"]: # Check for terminal failure states
                    full_response_details = json.dumps(file_status_result, indent=2)
                    logger.error(f"Commit polling failed with terminal state '{upload_state}'. Full response: \n{full_response_details}")
                    # Return error immediately, stop polling
                    return {"error": f"Commit failed with state: {upload_state}", "details": file_status_result}
                elif upload_state == "pendingCommit":
                     logger.info(f"Commit still pending (State: {upload_state}). Waiting {delay_seconds} seconds...")
                else: # Assume other states are also pending/transient, log and continue polling
                     logger.info(f"Commit in transient state: {upload_state}. Waiting {delay_seconds} seconds...")
                
            else:
                logger.warning(f"Commit polling attempt {attempt + 1} failed with status {response.status_code}: {response.text}")
                # Continue polling on transient HTTP errors, maybe? Or fail faster? Let's continue for now.
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Error during commit polling attempt {attempt + 1}: {e}")
            # Continue polling after transient network errors

        time.sleep(delay_seconds)

    logger.error(f"Commit polling timed out after {max_attempts} attempts for file {file_id}.")
    return {"error": "Commit polling timed out"}

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

def extract_file_encryption_info(intunewin_file_path: str) -> dict:
    """Extracts file encryption information from detection.xml within the .intunewin package.

    Args:
        intunewin_file_path: Path to the .intunewin file.

    Returns:
        A dictionary containing the file encryption info with camelCase keys.
        Returns an empty dictionary if extraction fails.
    """
    logger.info(f"Extracting file encryption info from {intunewin_file_path}...")
    detection_xml_path = "IntuneWinPackage/Metadata/Detection.xml"
    
    try:
        with zipfile.ZipFile(intunewin_file_path, 'r') as archive:
            if detection_xml_path not in archive.namelist():
                logger.error(f"{detection_xml_path} not found in the archive.")
                return {}
                
            with archive.open(detection_xml_path, 'r') as xml_file:
                xml_content = xml_file.read()
                
            # Parse XML
            try:
                root = ET.fromstring(xml_content)
                
                # Find the EncryptionInfo element
                encryption_info_element = root.find('.//EncryptionInfo')
                if encryption_info_element is None:
                    logger.error("EncryptionInfo element not found in detection.xml.")
                    return {}

                # Extract encryption details
                encryption_details = {
                    'EncryptionKey': encryption_info_element.findtext('.//EncryptionKey'),
                    'MacKey': encryption_info_element.findtext('.//MacKey'),
                    'InitializationVector': encryption_info_element.findtext('.//InitializationVector'),
                    'Mac': encryption_info_element.findtext('.//Mac'),
                    'ProfileIdentifier': encryption_info_element.findtext('.//ProfileIdentifier'),
                    'FileDigest': encryption_info_element.findtext('.//FileDigest'),
                    'FileDigestAlgorithm': encryption_info_element.findtext('.//FileDigestAlgorithm'),
                }
                 
                # Add the unencrypted size to the dictionary
                unencrypted_size_element = root.find('.//UnencryptedContentSize')
                size_text = unencrypted_size_element.text if unencrypted_size_element is not None else None
                try:
                    encryption_details['UnencryptedContentSize'] = int(size_text) if size_text else None
                except (ValueError, TypeError):
                    logger.warning(f"Could not convert UnencryptedContentSize '{size_text}' to integer. Setting to None.")
                    encryption_details['UnencryptedContentSize'] = None
 
                logger.info("Successfully extracted fileEncryptionInfo.")
                return encryption_details # Return dict with camelCase keys

            except ET.ParseError as e:
                logger.error(f"Failed to parse detection.xml: {e}")
                return {}
            except Exception as e:
                logger.error(f"Error processing detection.xml content: {e}")
                return {}

    except zipfile.BadZipFile:
        logger.error(f"Invalid or corrupted .intunewin file: {intunewin_file_path}")
        return {}
    except FileNotFoundError:
        logger.error(f".intunewin file not found: {intunewin_file_path}")
        return {}
    except Exception as e:
        logger.error(f"Failed to open or read {intunewin_file_path}: {e}")
        return {}

# Constants for chunked upload
CHUNK_SIZE = 6 * 1024 * 1024  # 6 MiB chunks
AZURE_BLOCK_BLOB_HEADER = {"x-ms-blob-type": "BlockBlob"}
AZURE_COMMIT_BLOCK_LIST_HEADERS = {"Content-Type": "application/xml"}
# The first 48 bytes of the encrypted payload in the zip seem to be skipped in examples.
ENCRYPTED_PAYLOAD_SKIP_BYTES = 48 

def _decrypt_and_upload_chunks(
    intunewin_file_path: str,
    encryption_info: Dict[str, str],
    upload_url: str,
    expected_unencrypted_size: int
) -> tuple:
    """Decrypts, chunks, and uploads the application payload from the .intunewin file."""
    logger.info("Starting decryption and chunked upload process...")
    
    try:
        # 1. Extract keys
        encryption_key_b64 = encryption_info.get('EncryptionKey') # Use camelCase key
        mac_key_b64 = encryption_info.get('MacKey')
        iv_b64 = encryption_info.get('InitializationVector')    # Use camelCase key
        mac_from_xml_b64 = encryption_info.get('Mac')             # Use camelCase key
        if not encryption_key_b64 or not mac_key_b64 or not iv_b64 or not mac_from_xml_b64:
            logger.error("Missing one or more critical keys (EncryptionKey, MacKey, InitializationVector, Mac) in encryption_info.")
            return False, None
 
        encryption_key = base64.b64decode(encryption_key_b64)
        iv = base64.b64decode(iv_b64)
        mac_key = base64.b64decode(mac_key_b64)
        mac_from_xml = base64.b64decode(mac_from_xml_b64)
 
        # --- Determine payload filename within the archive --- 
        # It's usually the same name as the .intunewin file but with a .bin extension,
        # but we'll find it dynamically to be sure.
        payload_filename = None
        detection_xml_path = "IntuneWinPackage/Metadata/Detection.xml"
        with zipfile.ZipFile(intunewin_file_path, 'r') as archive:
            if detection_xml_path in archive.namelist():
                with archive.open(detection_xml_path) as xml_file:
                    xml_content = xml_file.read()
                    root = ET.fromstring(xml_content)
                    # Use the FileName field from detection.xml for payload name
                    fname_element = root.find(".//FileName")
                    if fname_element is not None and fname_element.text:
                        payload_filename = fname_element.text.strip()

            if not payload_filename:
                 # Fallback: Try finding the largest file as payload if FileName field missing
                 contents_prefix = "IntuneWinPackage/Contents/"
                 payload_entry = max((entry for entry in archive.infolist()
                                      if not entry.is_dir() and entry.filename.startswith(contents_prefix)),
                                     key=lambda x: x.file_size, default=None)
                 if payload_entry:
                     payload_filename = payload_entry.filename # Use the full path found
                     logger.warning(f"Could not find FileName in detection.xml, guessing payload is: {payload_filename}")
                 else:
                    logger.error("Could not determine payload filename within the .intunewin archive.")
                    return False, None

            # Construct the full path within the archive
            if not payload_filename.startswith("IntuneWinPackage/Contents/"):
                payload_full_path = f"IntuneWinPackage/Contents/{payload_filename}"
            else:
                payload_full_path = payload_filename # Already has the path (e.g., from fallback)

            logger.info(f"Identified payload file within archive: {payload_full_path}")

            # 3. Decrypt, Unpad, Chunk, and Upload
            cipher = Cipher(algorithms.AES(encryption_key), modes.CBC(iv), backend=default_backend())
            decryptor = cipher.decryptor()
            unpadder = PKCS7(algorithms.AES.block_size).unpadder()
            block_ids = []
            chunk_index = 0
            total_uploaded_bytes = 0 # Track bytes for final size verification
            verified_unpadded_data_buffer = b'' # Buffer to hold verified data before upload
            sha256_hash = hashlib.sha256()

            with archive.open(payload_full_path, 'r') as encrypted_stream:
                encrypted_stream.read(ENCRYPTED_PAYLOAD_SKIP_BYTES)
                while True:
                    encrypted_chunk = encrypted_stream.read(CHUNK_SIZE)
                    is_last_encrypted_chunk = not encrypted_chunk

                    decrypted_chunk = None
                    if encrypted_chunk:
                        try:
                            decrypted_chunk = decryptor.update(encrypted_chunk)
                        except ValueError as e:
                            # This error can occur if PKCS7 padding is invalid
                            logger.error(f"Error decrypting chunk {chunk_index + 1} (update): {e}", exc_info=True)
                            return False, None

                    # Unpad the decrypted chunk and add to buffer
                    # Also update the hash incrementally
                    if decrypted_chunk:
                        try:
                            unpadded_chunk = unpadder.update(decrypted_chunk)
                            sha256_hash.update(unpadded_chunk)
                            verified_unpadded_data_buffer += unpadded_chunk
                        except ValueError as e:
                            # This error can occur if PKCS7 padding is invalid
                            logger.error(f"Error unpadding chunk {chunk_index + 1} (update): {e}", exc_info=True)
                            return False, None

                    if is_last_encrypted_chunk:
                        break

            # Finalize decryption
            try:
                decrypted_final_padded = decryptor.finalize()
            except Exception as e:
                logger.error(f"Error finalizing decryption: {e}", exc_info=True)
                return False, None
            
            # Finalize unpadding and update hash
            try:
                unpadded_final = unpadder.update(decrypted_final_padded) + unpadder.finalize()
                sha256_hash.update(unpadded_final)
                verified_unpadded_data_buffer += unpadded_final
            except Exception as e:
                logger.error(f"Error finalizing unpadding on full buffer: {e}", exc_info=True)
                return False, None

            # Calculate SHA256 hash of the full unpadded data
            calculated_digest = sha256_hash.digest()
            calculated_digest_b64 = base64.b64encode(calculated_digest).decode('utf-8')

            expected_digest_b64 = encryption_info.get('FileDigest')
            if not expected_digest_b64:
                logger.error("Missing 'FileDigest' in encryption_info.")
                return False, None

            logger.info(f"Expected Digest (Base64): {expected_digest_b64}")
            logger.info(f"Calculated Digest (Base64): {calculated_digest_b64}")

            if calculated_digest_b64 != expected_digest_b64:
                logger.critical("Calculated SHA256 digest DOES NOT MATCH the expected digest from detection.xml!")
                logger.critical("Aborting upload commitment.")
                return False, None
            else:
                logger.info("Calculated SHA256 digest matches expected digest.")

            # Verify HMAC-SHA256 MAC
            logger.info("Verifying HMAC-SHA256 MAC of encrypted content...")
            encrypted_payload_bytes = archive.open(payload_full_path, 'r').read()
            hmac_calculator = hmac.new(mac_key, digestmod=hashlib.sha256)
            hmac_calculator.update(encrypted_payload_bytes)
            calculated_mac = hmac_calculator.digest()
            logger.info(f"MAC from XML (b64): {mac_from_xml_b64}")
            logger.info(f"Calculated MAC (b64): {base64.b64encode(calculated_mac).decode()}")
            if calculated_mac == mac_from_xml:
                logger.info("MAC Verification SUCCESS: Calculated MAC matches the MAC from detection.xml.")
            else:
                logger.warning("MAC Verification FAILED: Calculated MAC does NOT match the MAC from detection.xml. Proceeding anyway for diagnostics...")

            # Now, upload the unpadded data in chunks
            logger.info("Starting upload of verified, unpadded data...")
            current_pos = 0
            chunk_index = 0 # Reset chunk index for upload
            block_ids = [] # Reset block IDs for upload
            total_bytes_uploaded = 0 # Reset bytes counter

            while current_pos < len(verified_unpadded_data_buffer):
                upload_chunk = verified_unpadded_data_buffer[current_pos:current_pos + CHUNK_SIZE]
                current_pos += len(upload_chunk)
                chunk_index += 1

                block_id_str = str(chunk_index).zfill(4)
                block_id_b64 = base64.b64encode(block_id_str.encode('ascii')).decode('ascii')
                logger.info(f"Uploading verified chunk {chunk_index} ({len(upload_chunk)} bytes)... Block ID: {chunk_index:04d} ({block_id_b64})")

                try:
                    upload_resp = requests.put(f"{upload_url}&comp=block&blockid={block_id_b64}",
                                               data=upload_chunk,
                                               headers={'x-ms-blob-type': 'BlockBlob'})
                    upload_resp.raise_for_status()
                    block_ids.append(block_id_b64)
                    total_bytes_uploaded += len(upload_chunk)
                    logger.debug(f"Verified chunk {chunk_index} uploaded successfully.")
                except requests.exceptions.RequestException as e:
                    logger.error(f"Failed to upload verified chunk {chunk_index}: {e.response.status_code if e.response else 'N/A'} - {e.response.text if e.response else e}")
                    return False, None

            # Commit the block list for the Azure blob
            commit_list_xml = '<?xml version="1.0" encoding="utf-8"?><BlockList>' + ''.join([f'<Latest>{bid}</Latest>' for bid in block_ids]) + '</BlockList>'
            commit_url = f"{upload_url}&comp=blocklist"
            try:
                commit_response = requests.put(
                    commit_url,
                    headers=AZURE_COMMIT_BLOCK_LIST_HEADERS,
                    data=commit_list_xml.encode('utf-8')
                )
                commit_response.raise_for_status()
                logger.info("Block list committed successfully.")
            except requests.exceptions.RequestException as e:
                logger.error(f"Failed to commit block list: {e.response.status_code if e.response else 'N/A'} - {e.response.text if e.response else e}")
                return False, None

            # Verify size after commit
            logger.info(f"Verifying uploaded size. Expected: {expected_unencrypted_size}, Actual: {total_bytes_uploaded}")
            if total_bytes_uploaded != expected_unencrypted_size:
                logger.error(f"Uploaded size mismatch! Expected {expected_unencrypted_size} bytes, but uploaded {total_bytes_uploaded} bytes.")
                # Note: This might indicate an issue with decryption, unpadding, or the expected size value itself.
                return False, None
            else:
                logger.info("Uploaded size matches expected size.")

            logger.info("Waiting 60 seconds for Azure storage changes to propagate...")
            time.sleep(60)

        return True, calculated_digest_b64 # Upload successful

    except FileNotFoundError:
        logger.error(f".intunewin file not found: {intunewin_file_path}")
        return False, None
    except zipfile.BadZipFile:
        logger.error(f"Invalid or corrupted .intunewin file: {intunewin_file_path}")
        return False, None
    except ET.ParseError as e:
        logger.error(f"Failed to parse detection.xml within the archive: {e}")
        return False, None
    except Exception as e:
        logger.error(f"An unexpected error occurred during decryption/upload: {e}", exc_info=True) # Log traceback
        return False, None
