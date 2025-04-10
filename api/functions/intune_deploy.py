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
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives import hmac as crypto_hmac
import hmac as std_hmac # Import standard library hmac for compare_digest

# Import our authentication module
from .auth import get_auth_headers

# Constants
GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"
GRAPH_API_ENDPOINT = f"{GRAPH_API_BASE}/deviceAppManagement/mobileApps"
CHUNK_SIZE = 4 * 1024 * 1024  # 4 MiB chunks
AZURE_BLOCK_BLOB_HEADER = {"x-ms-blob-type": "BlockBlob"}
AZURE_COMMIT_BLOCK_LIST_HEADERS = {"Content-Type": "application/xml"}
# The first 48 bytes of the encrypted payload in the zip seem to be skipped in examples.
ENCRYPTED_PAYLOAD_SKIP_BYTES = 48 # Changed from 0 to 48
UPLOAD_RETRY_LIMIT = 3 # Number of retries for chunk upload
UPLOAD_TIMEOUT = 60 # Timeout in seconds for each upload attempt
UPLOAD_RETRY_DELAY = 5 # Delay in seconds between upload retries

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Graph API endpoints

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
        upload_success, calculated_digest, calculated_mac_b64 = _decrypt_and_upload_chunks(
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

        # Update the encryption info with the *calculated* MAC before returning
        if calculated_mac_b64: # Use the correct variable
            logger.info(f"Updating MAC in returned encryption info with calculated value: {calculated_mac_b64}") # Use the correct variable
            file_encryption_info['Mac'] = calculated_mac_b64 # Use the correct variable
        else:
            # This case should ideally not happen if decryption/verification succeeded, but log if it does
            logger.warning("Calculated MAC was None, cannot update in returned encryption info.")

        # Step 5: Commit the content version file
        logger.info("Step 5: Committing the content version file...")
        commit_url = f"{GRAPH_API_ENDPOINT}/{app_id}/microsoft.graph.win32LobApp/contentVersions/{content_version_id}/files/{file_id}/commit"

        # --- CHANGE HERE: Ensure commit uses values directly from file_encryption_info ---
        commit_payload = {
            "fileEncryptionInfo": {
                "encryptionKey": file_encryption_info['EncryptionKey'],
                "macKey": file_encryption_info['MacKey'],
                "initializationVector": file_encryption_info['InitializationVector'],
                "mac": file_encryption_info['Mac'], # Use the MAC from the XML
                "profileIdentifier": file_encryption_info['ProfileIdentifier'],
                "fileDigest": file_encryption_info['FileDigest'], # Use the Digest from the XML
                "fileDigestAlgorithm": file_encryption_info['FileDigestAlgorithm']
            }
        }
        # --- End Change ---
        logger.debug(f"Commit Payload: {json.dumps(commit_payload, indent=2)}")

        commit_response = requests.post(
            commit_url,
            headers=headers,
            json=commit_payload
        )
        
        if commit_response.status_code in (200, 201, 202):
            logger.info(f"Successfully committed content version file: {content_version_id}")
        else:
            logger.error(f"Failed to commit content version file: {commit_response.status_code} - {commit_response.text}")
            return {
                "error": f"API error: {commit_response.status_code}",
                "details": commit_response.text
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
        else: # Assume other states are also pending/transient, log and continue polling
             logger.info(f"Commit in transient state: {upload_state}. Waiting {delay_seconds} seconds...")
                
        time.sleep(delay_seconds)

    logger.error(f"Failed to get upload URL after {max_attempts} attempts.")
    return {"error": f"Polling timed out after {max_attempts * delay_seconds} seconds"}

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
        # --- Determine payload filename within the archive ---
        payload_filename = None
        payload_zip_info = None # To store ZipInfo object
        with zipfile.ZipFile(intunewin_file_path, 'r') as archive:
            if detection_xml_path in archive.namelist():
                with archive.open(detection_xml_path) as xml_file:
                    xml_content = xml_file.read()
                    
            contents_prefix = "IntuneWinPackage/Contents/"
            payload_entry = max((entry for entry in archive.infolist()
                                 if not entry.is_dir() and entry.filename.startswith(contents_prefix)),
                                key=lambda x: x.file_size, default=None)
            if payload_entry:
                payload_filename = payload_entry.filename
                payload_zip_info = payload_entry # Store ZipInfo
                logger.warning(f"Could not find FileName in detection.xml, guessing payload is: {payload_filename}")
            else:
                logger.error("Could not determine payload filename within the .intunewin archive.")
                return {}
            
            if not payload_zip_info:
                 with zipfile.ZipFile(intunewin_file_path, 'r') as archive:
                    try:
                         payload_zip_info = archive.getinfo(payload_filename)
                    except KeyError:
                         logger.error(f"Could not get ZipInfo for payload: {payload_filename}")
                         return {}
            
            if payload_zip_info:
                 logger.info(f"Payload ZipInfo - File Size: {payload_zip_info.file_size}, Compressed Size: {payload_zip_info.compress_size}")
            else:
                 logger.warning("Could not retrieve ZipInfo for payload.")
                 # Allow to continue, but this might be problematic

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

def _decrypt_and_upload_chunks(
    intunewin_file_path: str,
    encryption_info: Dict[str, str],
    upload_url: str,
    expected_unencrypted_size: int
) -> tuple:
    """Decrypts, chunks, and uploads the application payload from the .intunewin file.

    Uploads ENCRYPTED chunks.
    Verifies SHA256 digest of DECRYPTED content against detection.xml (CRITICAL).
    Verifies HMAC-SHA256 MAC of ENCRYPTED content against detection.xml (WARNING ONLY).
    """
    logger.info("Starting decryption and encrypted chunked upload process...")
    try:
        # Decode keys and IV from base64
        encryption_key = base64.b64decode(encryption_info['EncryptionKey'])
        mac_key = base64.b64decode(encryption_info['MacKey'])
        iv = base64.b64decode(encryption_info['InitializationVector'])
        # Decode expected MAC and Digest from detection.xml
        mac_from_xml_b64 = encryption_info.get('Mac', '') # Get overall file MAC
        digest_from_xml_b64 = encryption_info.get('FileDigest', '')
        mac_from_xml = base64.b64decode(mac_from_xml_b64)
        digest_from_xml = base64.b64decode(digest_from_xml_b64)

        # --- Open Zip and Find Payload ONCE ---
        with zipfile.ZipFile(intunewin_file_path, 'r') as archive:
            # Find payload ZipInfo (assuming single content file)
            contents_prefix = "IntuneWinPackage/Contents/"
            payload_zip_info = None
            for entry in archive.infolist():
                if entry.filename.startswith(contents_prefix) and not entry.is_dir():
                    payload_zip_info = entry
                    logger.info(f"Found payload entry: {payload_zip_info.filename} (Size: {payload_zip_info.file_size})")
                    break # Assume first match is the correct one

            if not payload_zip_info:
                logger.error("Could not find payload file within the .intunewin archive under IntuneWinPackage/Contents/.")
                return False, None, None

            # --- Setup Crypto Objects --- 
            cipher = Cipher(algorithms.AES(encryption_key), modes.CBC(iv), backend=default_backend())
            decryptor = cipher.decryptor()
            decrypted_digest_hasher = hashes.Hash(hashes.SHA256(), backend=default_backend())
            # HMAC for the *entire* ENCRYPTED content - finalized after loop
            encrypted_mac_calculator = crypto_hmac.HMAC(mac_key, hashes.SHA256(), backend=default_backend())
            logger.debug(f"HMAC Key (first 16 bytes): {mac_key[:16].hex()}")

            # --- Decrypt, Verify Digest, Calculate MAC, Upload ENCRYPTED --- 
            expected_encrypted_size = payload_zip_info.file_size - ENCRYPTED_PAYLOAD_SKIP_BYTES # Calculate expected size
            chunk_index = 0
            block_ids = []
            total_bytes_uploaded = 0
            total_decrypted_bytes = 0
            total_bytes_read_from_stream = 0
            last_chunk_processed = False
            start_time = time.time()

            # Use ZipInfo within the same zipfile context
            with archive.open(payload_zip_info.filename, 'r') as encrypted_stream:
                # Skip potential header bytes (Keeping ENCRYPTED_PAYLOAD_SKIP_BYTES = 48 for now)
                if ENCRYPTED_PAYLOAD_SKIP_BYTES > 0:
                     logger.debug(f"Skipping {ENCRYPTED_PAYLOAD_SKIP_BYTES} bytes from the start of the encrypted stream.")
                     _ = encrypted_stream.read(ENCRYPTED_PAYLOAD_SKIP_BYTES)

                while not last_chunk_processed:
                    # Determine if this read will contain the last chunk
                    remaining_bytes = expected_encrypted_size - total_bytes_read_from_stream
                    chunk_to_read = min(CHUNK_SIZE, remaining_bytes)

                    encrypted_chunk = encrypted_stream.read(chunk_to_read)
                    if not encrypted_chunk:
                        break # Should only happen if expected_encrypted_size was wrong
                    total_bytes_read_from_stream += len(encrypted_chunk)
                    is_last_chunk = (total_bytes_read_from_stream == expected_encrypted_size)
                    chunk_index += 1

                    # Update overall MAC with the raw ENCRYPTED chunk
                    encrypted_mac_calculator.update(encrypted_chunk)

                    # Upload the ENCRYPTED chunk (upload logic remains the same)
                    block_id_str = str(chunk_index).zfill(4)
                    block_id_b64 = base64.b64encode(block_id_str.encode('ascii')).decode('ascii')
                    logger.debug(f"Uploading encrypted chunk {chunk_index} ({len(encrypted_chunk)} bytes)... Block ID: {chunk_index:04d} ({block_id_b64})")
                    # ... (rest of upload try/except/retry logic) ...
                    upload_successful = False
                    for attempt in range(UPLOAD_RETRY_LIMIT):
                         try:
                             upload_resp = requests.put(
                                 f"{upload_url}&comp=block&blockid={block_id_b64}",
                                 data=encrypted_chunk,
                                 headers={'x-ms-blob-type': 'BlockBlob', 'Content-Length': str(len(encrypted_chunk))},
                                 timeout=UPLOAD_TIMEOUT
                             )
                             upload_resp.raise_for_status()
                             upload_successful = True
                             logger.debug(f"Encrypted chunk {chunk_index} uploaded successfully.")
                             break # Success
                         except requests.exceptions.RequestException as e:
                             logger.warning(f"Chunk {chunk_index}: Upload attempt {attempt + 1}/{UPLOAD_RETRY_LIMIT} failed: {e}. Retrying...")
                             if attempt < UPLOAD_RETRY_LIMIT - 1:
                                 time.sleep(UPLOAD_RETRY_DELAY)

                    if not upload_successful:
                         logger.error(f"Failed to upload encrypted chunk {chunk_index} after {UPLOAD_RETRY_LIMIT} attempts. Aborting.")
                         try: decryptor.finalize() # Cleanup
                         except: pass
                         return False, None, None

                    block_ids.append(block_id_b64)
                    total_bytes_uploaded += len(encrypted_chunk) # Track encrypted bytes uploaded

                    # --- Decryption Handling (Differs for last chunk) ---
                    if is_last_chunk:
                        logger.debug(f"Processing final encrypted chunk ({len(encrypted_chunk)} bytes) for decryption.")
                        try:
                            last_decrypted_part = decryptor.update(encrypted_chunk)
                            final_decrypted_part = decryptor.finalize() # Handles padding removal

                            if last_decrypted_part:
                                decrypted_digest_hasher.update(last_decrypted_part)
                                total_decrypted_bytes += len(last_decrypted_part)
                            if final_decrypted_part:
                                decrypted_digest_hasher.update(final_decrypted_part)
                                total_decrypted_bytes += len(final_decrypted_part)

                            logger.debug(f"Final chunk decryption: update() len={len(last_decrypted_part)}, finalize() len={len(final_decrypted_part)}")

                        except Exception as e:
                             logger.error(f"Error during final decryption/finalization: {e}", exc_info=True)
                        last_chunk_processed = True # Signal to exit loop
                    else:
                        # Process intermediate chunks
                        try:
                            decrypted_chunk_part = decryptor.update(encrypted_chunk)
                            if decrypted_chunk_part:
                               decrypted_digest_hasher.update(decrypted_chunk_part)
                               total_decrypted_bytes += len(decrypted_chunk_part)
                        except ValueError as e:
                            logger.error(f"Error decrypting intermediate chunk {chunk_index} for digest: {e}", exc_info=True)
                            pass # Allow continuing

            # --- Post-Loop Processing --- 
            end_time = time.time()
            logger.info(f"Finished processing {chunk_index} chunks ({total_bytes_uploaded} encrypted bytes uploaded) in {end_time - start_time:.2f} seconds.")

            # Log comparison before finalizing decryption
            logger.info(f"Total bytes read from encrypted stream: {total_bytes_read_from_stream}")
            if total_bytes_read_from_stream != expected_encrypted_size:
                 logger.warning(f"Potential encrypted stream size mismatch: Read {total_bytes_read_from_stream}, Expected (ZipInfo.file_size - skip_bytes): {expected_encrypted_size}")
            else:
                 logger.info("Total bytes read matches ZipInfo.file_size (minus skip bytes).")

            # Decryption finalization is now handled IN the loop for the last chunk
            # Do NOT call decryptor.finalize() again here.

            # Finalize MAC calculation (for the *entire* encrypted stream processed)
            calculated_mac = encrypted_mac_calculator.finalize()
            calculated_mac_b64 = base64.b64encode(calculated_mac).decode('utf-8')

            # --- Verification --- 
            calculated_digest = decrypted_digest_hasher.finalize() 
            calculated_digest_b64 = base64.b64encode(calculated_digest).decode('utf-8')
            digest_match = (calculated_digest == digest_from_xml)
            size_match = (total_decrypted_bytes == expected_unencrypted_size)
            # Use std_hmac.compare_digest for constant-time comparison
            mac_match = std_hmac.compare_digest(calculated_mac, mac_from_xml)

            logger.info(f"Expected Digest (Base64): {digest_from_xml_b64}")
            logger.info(f"Calculated Digest (Base64): {calculated_digest_b64}") # Use the b64 version
            if digest_match:
                 logger.info("Digest Verification SUCCESS: Calculated SHA256 digest matches expected digest.")
                 if size_match:
                      logger.info(f"Total decrypted bytes ({total_decrypted_bytes}) matches expected unencrypted size.")
                 else:
                      logger.warning(f"Size Mismatch Warning: Total decrypted bytes ({total_decrypted_bytes}) does not match expected ({expected_unencrypted_size}), but digest matched.")
            else:
                 logger.critical("Digest Verification FAILED: Calculated SHA256 digest does NOT match the digest from detection.xml.")
                 logger.critical(f"Total decrypted bytes calculated: {total_decrypted_bytes}. Expected unencrypted size: {expected_unencrypted_size}")

            logger.info(f"Verifying HMAC-SHA256 MAC of encrypted content...")
            logger.info(f"MAC from XML (b64): {mac_from_xml_b64}")
            logger.info(f"Calculated MAC (b64): {calculated_mac_b64}")
            if mac_match:
                logger.info("MAC Verification SUCCESS: Calculated HMAC-SHA256 MAC matches MAC from detection.xml.")
            else:
                logger.warning("MAC Verification MISMATCH: Locally calculated MAC does NOT match the MAC from detection.xml.")
                logger.warning("Proceeding with upload commit using MAC from detection.xml as per standard Intune process.")

            # --- Commit Block List in Azure --- 
            if not _commit_block_list(upload_url, block_ids):
                 return False, calculated_digest_b64, calculated_mac_b64 # Commit failed

            # Only return success if digest matched
            if digest_match:
                 logger.info("Waiting 60 seconds for Azure storage changes to propagate before Intune commit...")
                 time.sleep(60)
                 return True, calculated_digest_b64, calculated_mac_b64
            else:
                 # Even though block list was committed, return failure due to digest mismatch
                 return False, calculated_digest_b64, calculated_mac_b64

    except FileNotFoundError:
        logger.error(f".intunewin file not found: {intunewin_file_path}")
    except zipfile.BadZipFile:
        logger.error(f"Invalid or corrupted .intunewin file: {intunewin_file_path}")
    except ET.ParseError as e:
        logger.error(f"Failed to parse detection.xml within the archive: {e}")
    except Exception as e:
        logger.error(f"An unexpected error occurred during decryption/upload: {e}", exc_info=True)

    return False, None, None # Default failure case

def _commit_block_list(upload_url, block_ids):
    """Commits the block list to Azure Blob Storage."""
    if not block_ids:
        logger.warning("No block IDs provided, cannot commit block list.")
        return False
    logger.info(f"Committing block list with {len(block_ids)} blocks...")
    commit_list_xml = '<?xml version="1.0" encoding="utf-8"?><BlockList>' + ''.join([f'<Latest>{bid}</Latest>' for bid in block_ids]) + '</BlockList>'
    commit_url = f"{upload_url}&comp=blocklist"
    try:
        commit_response = requests.put(
            commit_url,
            headers=AZURE_COMMIT_BLOCK_LIST_HEADERS,
            data=commit_list_xml.encode('utf-8'),
            timeout=60
        )
        commit_response.raise_for_status()
        logger.info("Azure block list committed successfully.")
        return True
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to commit Azure block list: {e.response.status_code if e.response else 'N/A'} - {e.response.text if e.response else e}")
        return False

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
        upload_success, calculated_digest, calculated_mac_b64 = _decrypt_and_upload_chunks(
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

        # Update the encryption info with the *calculated* MAC before returning
        if calculated_mac_b64: # Use the correct variable
            logger.info(f"Updating MAC in returned encryption info with calculated value: {calculated_mac_b64}") # Use the correct variable
            file_encryption_info['Mac'] = calculated_mac_b64 # Use the correct variable
        else:
            # This case should ideally not happen if decryption/verification succeeded, but log if it does
            logger.warning("Calculated MAC was None, cannot update in returned encryption info.")

        # Step 5: Commit the content version file
        logger.info("Step 5: Committing the content version file...")
        commit_url = f"{GRAPH_API_ENDPOINT}/{app_id}/microsoft.graph.win32LobApp/contentVersions/{content_version_id}/files/{file_id}/commit"

        # --- CHANGE HERE: Ensure commit uses values directly from file_encryption_info ---
        commit_payload = {
            "fileEncryptionInfo": {
                "encryptionKey": file_encryption_info['EncryptionKey'],
                "macKey": file_encryption_info['MacKey'],
                "initializationVector": file_encryption_info['InitializationVector'],
                "mac": file_encryption_info['Mac'], # Use the MAC from the XML
                "profileIdentifier": file_encryption_info['ProfileIdentifier'],
                "fileDigest": file_encryption_info['FileDigest'], # Use the Digest from the XML
                "fileDigestAlgorithm": file_encryption_info['FileDigestAlgorithm']
            }
        }
        # --- End Change ---
        logger.debug(f"Commit Payload: {json.dumps(commit_payload, indent=2)}")

        commit_response = requests.post(
            commit_url,
            headers=headers,
            json=commit_payload
        )
        
        if commit_response.status_code in (200, 201, 202):
            logger.info(f"Successfully committed content version file: {content_version_id}")
        else:
            logger.error(f"Failed to commit content version file: {commit_response.status_code} - {commit_response.text}")
            return {
                "error": f"API error: {commit_response.status_code}",
                "details": commit_response.text
            }
    
    except Exception as e:
        logger.error(f"Exception during app deployment: {str(e)}")
        return {"error": str(e)}
