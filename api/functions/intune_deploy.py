"""
Intune Win32 App Deployment Module

This module provides functions to deploy Win32 applications to Microsoft Intune
using the Microsoft Graph API.
"""

import json
import base64
import logging
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
    setup_file_path: Optional[str] = None,
    detection_rules: Optional[List[Dict[str, Any]]] = None,
    requirement_rules: Optional[List[Dict[str, Any]]] = None,
    icon_path: Optional[str] = None,
    minimum_os: Optional[str] = None,
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
        detection_rules: List of detection rules
        requirement_rules: List of requirement rules
        icon_path: Path to the application icon
        minimum_os: Minimum supported Windows version
        architecture: Architecture ("x86", "x64", "arm", "neutral")
    
    Returns:
        API response from Intune
    """
    # Get authorization headers using our auth module
    headers = get_auth_headers()
    if not headers:
        logger.error("Failed to get authorization headers")
        return {"error": "Authentication failed"}
    
    # Check if .intunewin file exists
    if not os.path.exists(intunewin_file_path):
        logger.error(f"Intunewin file not found: {intunewin_file_path}")
        return {"error": f"Intunewin file not found: {intunewin_file_path}"}
    
    try:
        # Step 1: Create a mobile app
        app_result = create_mobile_app(headers, display_name, description, publisher)
        if "error" in app_result:
            return app_result
        
        app_id = app_result.get("id")
        logger.info(f"Created mobile app with ID: {app_id}")
        
        # Step 2: Create a content version for the app
        content_version_result = create_content_version(headers, app_id)
        if "error" in content_version_result:
            return content_version_result
        
        content_version_id = content_version_result.get("id")
        logger.info(f"Created content version with ID: {content_version_id}")
        
        # Step 3: Get content upload URLs
        upload_urls_result = get_content_upload_urls(headers, app_id, content_version_id, 
                                                    os.path.getsize(intunewin_file_path))
        if "error" in upload_urls_result:
            return upload_urls_result
        
        # Step 4: Upload the .intunewin file
        upload_result = upload_intunewin_file(
            upload_urls_result.get("uploadUrl"), 
            upload_urls_result.get("contentVersion"), 
            intunewin_file_path
        )
        if "error" in upload_result:
            return upload_result
        
        logger.info("Successfully uploaded .intunewin file")
        
        # Step 5: Commit the content version
        commit_result = commit_content_version(
            headers, app_id, content_version_id, 
            file_name=os.path.basename(intunewin_file_path),
            file_size=os.path.getsize(intunewin_file_path)
        )
        if "error" in commit_result:
            return commit_result
        
        logger.info("Successfully committed content version")
        
        # Initialize rules array
        rules = []
        
        # Add detection rules if provided
        if detection_rules:
            for rule in detection_rules:
                if rule.get("ruleType") != Win32AppRuleType.DETECTION:
                    rule["ruleType"] = Win32AppRuleType.DETECTION
                rules.append(rule)
        
        # Add requirement rules if provided
        if requirement_rules:
            for rule in requirement_rules:
                if rule.get("ruleType") != Win32AppRuleType.REQUIREMENT:
                    rule["ruleType"] = Win32AppRuleType.REQUIREMENT
                rules.append(rule)
        
        # Prepare icon if provided
        large_icon = None
        if icon_path:
            try:
                with open(icon_path, "rb") as icon_file:
                    icon_data = icon_file.read()
                    large_icon = {
                        "@odata.type": "microsoft.graph.mimeContent",
                        "type": "image/png",  # Adjust if icon is not PNG
                        "value": base64.b64encode(icon_data).decode('utf-8')
                    }
            except Exception as e:
                logger.warning(f"Failed to read icon file: {str(e)}")
        
        # Step 6: Update the Win32 app with details
        app_body = {
            "@odata.type": "#microsoft.graph.win32LobApp",
            "displayName": display_name,
            "description": description,
            "publisher": publisher,
            "fileName": os.path.basename(intunewin_file_path),
            "setupFilePath": setup_file_path or os.path.basename(intunewin_file_path),
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
            "committedContentVersion": content_version_id
        }
        
        # Add optional parameters if provided
        if large_icon:
            app_body["largeIcon"] = large_icon
        
        if minimum_os:
            app_body["minimumSupportedWindowsRelease"] = minimum_os
        
        if architecture:
            app_body["applicableArchitectures"] = architecture
        
        # Update the mobile app
        update_url = f"{GRAPH_API_ENDPOINT}/{app_id}"
        response = requests.patch(
            update_url,
            headers=headers,
            json=app_body
        )
        
        if response.status_code in (200, 201, 204):
            logger.info(f"Successfully deployed Win32 app: {display_name}")
            return {"id": app_id, "status": "success", "message": "App deployed successfully"}
        else:
            logger.error(f"Failed to update app: {response.status_code} - {response.text}")
            return {
                "error": f"API error: {response.status_code}",
                "details": response.text
            }
    
    except Exception as e:
        logger.error(f"Exception during app deployment: {str(e)}")
        return {"error": str(e)}

def create_mobile_app(headers: Dict[str, str], display_name: str, description: str, 
                     publisher: str) -> Dict[str, Any]:
    """
    Create a new mobile app in Intune.
    """
    app_body = {
        "@odata.type": "#microsoft.graph.win32LobApp",
        "displayName": display_name,
        "description": description,
        "publisher": publisher,
        "isFeatured": False,
        "fileName": display_name,
        "installExperience": {
            "@odata.type": "microsoft.graph.win32LobAppInstallExperience",
            "runAsAccount": "system",
            "deviceRestartBehavior": "basedOnReturnCode"
        }
    }
    
    try:
        response = requests.post(
            GRAPH_API_ENDPOINT,
            headers=headers,
            json=app_body
        )
        
        if response.status_code in (200, 201):
            return response.json()
        else:
            logger.error(f"Failed to create app: {response.status_code} - {response.text}")
            return {
                "error": f"API error: {response.status_code}",
                "details": response.text
            }
    except Exception as e:
        logger.error(f"Exception during app creation: {str(e)}")
        return {"error": str(e)}

def create_content_version(headers: Dict[str, str], app_id: str) -> Dict[str, Any]:
    """
    Create a content version for the app.
    """
    url = f"{GRAPH_API_ENDPOINT}/{app_id}/microsoft.graph.win32LobApp/contentVersions"
    
    try:
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

def get_content_upload_urls(headers: Dict[str, str], app_id: str, content_version_id: str, 
                           file_size: int, file_size_in_chunks: int = 1) -> Dict[str, Any]:
    """
    Get content upload URLs for the .intunewin file.
    """
    url = (f"{GRAPH_API_ENDPOINT}/{app_id}/microsoft.graph.win32LobApp/contentVersions/"
           f"{content_version_id}/files")
    
    body = {
        "fileEncryptionInfo": {
            "encryptionKey": "",
            "macKey": "",
            "initializationVector": "",
            "mac": "",
            "profileIdentifier": "",
            "fileDigest": "",
            "fileDigestAlgorithm": ""
        },
        "name": content_version_id,
        "size": file_size,
        "sizeEncrypted": file_size
    }
    
    try:
        response = requests.post(
            url,
            headers=headers,
            json=body
        )
        
        if response.status_code in (200, 201):
            return response.json()
        else:
            logger.error(f"Failed to get upload URLs: {response.status_code} - {response.text}")
            return {
                "error": f"API error: {response.status_code}",
                "details": response.text
            }
    except Exception as e:
        logger.error(f"Exception during getting upload URLs: {str(e)}")
        return {"error": str(e)}

def upload_intunewin_file(upload_url: str, content_version: str, file_path: str) -> Dict[str, Any]:
    """
    Upload the .intunewin file to Azure Storage.
    """
    try:
        with open(file_path, 'rb') as file:
            file_content = file.read()
            
        # Upload the file to Azure Storage
        headers = {
            'x-ms-blob-type': 'BlockBlob',
            'Content-Type': 'application/octet-stream'
        }
        
        response = requests.put(
            upload_url,
            headers=headers,
            data=file_content
        )
        
        if response.status_code in (200, 201, 204):
            return {"status": "success", "contentVersion": content_version}
        else:
            logger.error(f"Failed to upload file: {response.status_code} - {response.text}")
            return {
                "error": f"API error: {response.status_code}",
                "details": response.text
            }
    except Exception as e:
        logger.error(f"Exception during file upload: {str(e)}")
        return {"error": str(e)}

def commit_content_version(headers: Dict[str, str], app_id: str, content_version_id: str, 
                          file_name: str, file_size: int) -> Dict[str, Any]:
    """
    Commit the content version after file upload.
    """
    url = (f"{GRAPH_API_ENDPOINT}/{app_id}/microsoft.graph.win32LobApp/contentVersions/"
           f"{content_version_id}/commit")
    
    body = {
        "fileEncryptionInfo": {
            "encryptionKey": "",
            "macKey": "",
            "initializationVector": "",
            "mac": "",
            "profileIdentifier": "",
            "fileDigest": "",
            "fileDigestAlgorithm": ""
        },
        "fileName": file_name,
        "size": file_size,
        "sizeEncrypted": file_size
    }
    
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
