"""
High-level helper for uploading a .intunewin package from the App Library
and creating a Win32 LOB application in Intune with custom commands.
"""

from __future__ import annotations
import base64
import hashlib
import json
import logging
import re
import math
import os
import time
import uuid
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Dict, Tuple, Optional

import requests
# Ensure cryptography is installed if these are used directly,
# though _parse_detection_xml and _decrypt_file might be less directly used here
# if we assume the .intunewin is already processed to some extent or handled by a shared utility.
# from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

from .auth import get_auth_headers # Relative import for auth

logger = logging.getLogger(__name__)
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)

GRAPH_BASE = "https://graph.microsoft.com/beta"

# --------------------------------------------------------------------------------------
# Placeholder for helper functions (to be copied/adapted from intune_win32_uploader.py)
# _parse_detection_xml, _graph_request, _create_content_version, etc.
# --------------------------------------------------------------------------------------

def _graph_request(method: str, url: str, **kwargs):
    """Generic Graph API request helper."""
    headers = get_auth_headers()
    headers.update(kwargs.pop("headers", {}))
    logger.debug("GRAPH %s %s", method, url)
    if 'json' in kwargs and kwargs['json'] is not None:
        try:
            logger.debug("Payload: %s", json.dumps(kwargs['json'])[:1000])
        except Exception:
            pass
    resp = requests.request(method, url, headers=headers, **kwargs)
    logger.debug("Response status: %s", resp.status_code)
    logger.debug("Response snippet: %s", resp.text[:500])
    try:
        resp.raise_for_status()
    except requests.HTTPError as exc:
        raise requests.HTTPError(f"{exc}\n{resp.text}") from None
    return resp.json() if resp.content else None

def _parse_detection_xml(intunewin: Path) -> Tuple[Dict, Path]:
    """Return encryption metadata + path to the *encrypted* payload file."""
    with zipfile.ZipFile(intunewin) as zf:
        with zf.open("IntuneWinPackage/Metadata/Detection.xml") as f:
            root = ET.parse(f).getroot()

        enc = root.find("EncryptionInfo")
        if enc is None:
            raise ValueError("EncryptionInfo not found in Detection.xml")

        meta = {
            "file_name": root.findtext("FileName"),
            "unencrypted_size": int(root.findtext("UnencryptedContentSize")),
            "encryption_key": enc.findtext("EncryptionKey"),
            "iv": enc.findtext("InitializationVector"),
            "mac": enc.findtext("Mac"),
            "mac_key": enc.findtext("MacKey"),
            "profile_identifier": enc.findtext("ProfileIdentifier"),
            "file_digest": enc.findtext("FileDigest"),
            "digest_algorithm": enc.findtext("FileDigestAlgorithm") or "SHA256",
        }
        # Ensure file_name is not None before creating the path
        if meta["file_name"] is None:
            raise ValueError("FileName not found in Detection.xml")

        encrypted_blob_path = f"IntuneWinPackage/Contents/{meta['file_name']}"
        
        # Check if the encrypted blob exists in the zip file
        if encrypted_blob_path not in zf.namelist():
            raise FileNotFoundError(f"Encrypted content file '{encrypted_blob_path}' not found in the .intunewin package.")

        encrypted_blob = zf.extract(
            encrypted_blob_path,
            path=intunewin.parent,
        )
    return meta, Path(encrypted_blob)

def _create_app_shell_for_library(
    display_name: str,
    description: Optional[str],
    publisher: str,
    installer_name: str, # This is meta["file_name"] from _parse_detection_xml
    package_id: str, # App Library's unique ID for the app
    detection_script: str = "exit 0",
    install_command_override: Optional[str] = None,
    uninstall_command_override: Optional[str] = None,
) -> str:
    """Creates the application shell in Intune for an App Library item."""
    if not description:
        description = display_name

    install_cmd = install_command_override if install_command_override is not None else ""
    uninstall_cmd = uninstall_command_override if uninstall_command_override is not None else ""
    
    # If commands are empty, Intune might require them to be explicitly set to null or handle them.
    # For Win32LobApp, they are required. If empty, they should be valid (e.g., a comment or echo).
    # Let's default to a simple echo if empty to avoid Intune errors, or user must provide valid ones.
    # Alternatively, make them truly optional in the payload if Intune API allows.
    # For now, if empty, we'll use a placeholder that does nothing.
    # A better approach might be to make them non-optional in the Pydantic model if Intune requires them.
    # However, the user stated they can be optional.
    # If an empty string is not acceptable by Intune, this might need adjustment.
    # For Win32LobApp, installCommandLine and uninstallCommandLine are required.
    # Let's use a benign command if not provided.
    install_cmd = install_command_override or 'cmd.exe /c "echo App Library Install"'
    uninstall_cmd = uninstall_command_override or 'cmd.exe /c "echo App Library Uninstall"'


    body = {
        "@odata.type": "#microsoft.graph.win32LobApp",
        "displayName": display_name,
        "description": description,
        "publisher": publisher,
        "fileName": installer_name, # The actual .intunewin file name (e.g., 7z.intunewin)
        "setupFilePath": installer_name, # Relative path to the primary setup file
        "installCommandLine": install_cmd,
        "uninstallCommandLine": uninstall_cmd,
        "applicableArchitectures": "x64", # Or make this configurable
        "minimumSupportedWindowsRelease": "1607", # Or make this configurable
        "notes": f"App Library ID: {package_id}", # Using notes to store app library package_id
        "rules": [
            {
                "@odata.type": "#microsoft.graph.win32LobAppPowerShellScriptRule",
                "ruleType": "detection",
                "enforceSignatureCheck": False,
                "runAs32Bit": False,
                "scriptContent": base64.b64encode(detection_script.encode("utf-8")).decode(),
                "operationType": "notConfigured", # Default, can be 'string', 'dateTime', etc.
                "operator": "notConfigured" # Default, can be 'greaterThan', 'equal', etc.
            }
        ],
        "installExperience": {
            "@odata.type": "#microsoft.graph.win32LobAppInstallExperience",
            "runAsAccount": "system", # Or 'user'
            "deviceRestartBehavior": "suppress" # Other options: 'allow', 'requireGracePeriod', 'requireImmediate'
        },
        "returnCodes": [ # Default success code
            {"@odata.type": "#microsoft.graph.win32LobAppReturnCode", "returnCode": 0, "type": "success"}
        ]
    }
    result = _graph_request("POST", f"{GRAPH_BASE}/deviceAppManagement/mobileApps", json=body)
    return result["id"]

def _create_content_version(app_id: str) -> str:
    result = _graph_request(
        "POST",
        f"{GRAPH_BASE}/deviceAppManagement/mobileApps/{app_id}"
        "/microsoft.graph.win32LobApp/contentVersions",
        json={} # Empty body creates a new draft version
    )
    return result["id"]

def _create_file_placeholder(app_id: str, version_id: str, meta: Dict, encrypted_path: Path) -> Dict:
    body = {
        "@odata.type": "#microsoft.graph.mobileAppContentFile",
        "name": meta["file_name"],
        "size": meta["unencrypted_size"],
        "sizeEncrypted": os.path.getsize(encrypted_path),
        "isDependency": False,
        # "manifest": null, # Optional Base64 encoded manifest XML
    }
    return _graph_request(
        "POST",
        f"{GRAPH_BASE}/deviceAppManagement/mobileApps/{app_id}"
        f"/microsoft.graph.win32LobApp/contentVersions/{version_id}/files",
        json=body
    )

def _wait_for_storage_uri(app_id: str, version_id: str, file_id: str, timeout=300) -> Dict:
    url = (f"{GRAPH_BASE}/deviceAppManagement/mobileApps/{app_id}"
           f"/microsoft.graph.win32LobApp/contentVersions/{version_id}/files/{file_id}")
    for _ in range(timeout // 5): # Poll every 5 seconds
        data = _graph_request("GET", url)
        if data.get("azureStorageUri"):
            return data
        time.sleep(5)
    raise TimeoutError("Timed out waiting for AzureStorageUri")

def _upload_to_blob(payload_file: Path, sas_uri: str, block_size=4 * 1024 * 1024):
    total = os.path.getsize(payload_file)
    blocks = []
    logger.info("Uploading decrypted payload to Azure Blob (%s bytes)...", total)
    with open(payload_file, "rb") as fh:
        idx = 0
        while chunk := fh.read(block_size):
            block_id = base64.b64encode(f"{idx:05}".encode()).decode()
            params = {"comp": "block", "blockid": block_id}
            # Ensure SAS URI already contains '?' for query params
            put_uri = sas_uri if '?' in sas_uri else sas_uri + '?'
            requests.put(put_uri, params=params, data=chunk, headers={'x-ms-blob-type': 'BlockBlob'}).raise_for_status()
            blocks.append(block_id)
            idx += 1
    logger.info("Upload complete, committing block list...")
    block_list_xml = (
        '<?xml version="1.0" encoding="utf-8"?><BlockList>'
        + "".join(f"<Latest>{b}</Latest>" for b in blocks)
        + "</BlockList>"
    )
    commit_uri = sas_uri if '?' in sas_uri else sas_uri + '?'
    requests.put(commit_uri, params={"comp": "blocklist"}, data=block_list_xml,
                 headers={"Content-Type": "application/xml"}).raise_for_status()

def _commit_file(app_id: str, version_id: str, file_id: str, meta: Dict):
    logger.info("Committing file to Intune...")
    body = {
        "fileEncryptionInfo": {
            "@odata.type": "microsoft.graph.fileEncryptionInfo",
            "encryptionKey": meta["encryption_key"],
            "initializationVector": meta["iv"],
            "mac": meta["mac"],
            "macKey": meta["mac_key"],
            "profileIdentifier": meta["profile_identifier"],
            "fileDigest": meta["file_digest"],
            "fileDigestAlgorithm": meta["digest_algorithm"],
        }
    }
    _graph_request(
        "POST",
        f"{GRAPH_BASE}/deviceAppManagement/mobileApps/{app_id}"
        f"/microsoft.graph.win32LobApp/contentVersions/{version_id}/files/{file_id}/commit",
        json=body
    )

def _wait_for_commit(app_id: str, version_id: str, file_id: str, timeout=600):
    url = (f"{GRAPH_BASE}/deviceAppManagement/mobileApps/{app_id}"
           f"/microsoft.graph.win32LobApp/contentVersions/{version_id}/files/{file_id}")
    logger.info("Waiting for Intune to finish processing the file commit...")
    for _ in range(timeout // 10): # Poll every 10 seconds
        data = _graph_request("GET", url)
        logger.info(
            "Commit poll → isCommitted=%s  uploadState=%s  size=%s",
            data.get("isCommitted"), data.get("uploadState", "n/a"), data.get("size")
        )
        if data.get("uploadState") == "commitFileFailed":
            raise RuntimeError(f"Intune reported commit failure: {json.dumps(data)[:1000]}")
        if data.get("isCommitted"):
            logger.info("File commit completed!")
            return
        time.sleep(10)
    raise TimeoutError("Timed out waiting for file commit")

def _commit_content_version(app_id: str, version_id: str):
    logger.info("Committing content version %s to the mobileApp…", version_id)
    body = {"@odata.type": "#microsoft.graph.win32LobApp", "committedContentVersion": version_id}
    _graph_request("PATCH", f"{GRAPH_BASE}/deviceAppManagement/mobileApps/{app_id}", json=body)

def _wait_for_published(app_id: str, timeout=900):
    url = f"{GRAPH_BASE}/deviceAppManagement/mobileApps/{app_id}"
    logger.info("Waiting for Intune to publish the app …")
    for _ in range(timeout // 10): # Poll every 10 seconds
        data = _graph_request("GET", url)
        logger.info("Publish poll → publishingState=%s", data.get("publishingState"))
        if data.get("publishingState") == "published":
            logger.info("App is now published and ready!")
            return
        time.sleep(10)
    raise TimeoutError("Timed out waiting for publishingState='published'")


def upload_app_library_intunewin(
    path: str | Path, # Path to the (decrypted) .intunewin file, usually temporary
    display_name: str,
    package_id: str, # App Library's unique ID for the app
    description: Optional[str] = None,
    publisher: str = "",
    detection_script: Optional[str] = None,
    install_command: Optional[str] = None,
    uninstall_command: Optional[str] = None,
) -> str:
    """
    End-to-end helper for App Library deployments.
    Uploads a .intunewin package to Intune using provided commands.

    Parameters
    ----------
    path : str | Path
        Filesystem path to the .intunewin file (e.g., downloaded from Backblaze).
    display_name : str
        Friendly name to show in Intune.
    package_id : str
        The App Library's unique identifier for this application (e.g., "APP001").
    description : str, optional
        Descriptive text shown in Intune. Defaults to display_name if omitted.
    publisher : str, optional
        Publisher name; defaults to empty.
    detection_script : str, optional
        A PowerShell detection script. Defaults to "exit 0" if omitted.
    install_command : str, optional
        The exact install command line for the application.
    uninstall_command : str, optional
        The exact uninstall command line for the application.

    Returns
    -------
    str
        The new mobileApp (Win32 LOB) ID in Intune.
    """
    logger.info("Starting App Library Win32 upload: %s → '%s' (AppLib ID: %s)", path, display_name, package_id)

    intunewin_path = Path(path).expanduser().resolve().absolute()
    if not intunewin_path.exists():
        raise FileNotFoundError(f"The .intunewin file was not found at: {intunewin_path}")

    # 1. Parse .intunewin metadata (to get actual installer name, encryption info for commit)
    #    The file at `intunewin_path` is the one downloaded from Backblaze.
    #    It's assumed this is a standard .intunewin file.
    meta, encrypted_content_path = _parse_detection_xml(intunewin_path)
    # `encrypted_content_path` is the path to the actual encrypted payload extracted from the .intunewin
    # This is what needs to be uploaded to Azure Blob.

    # 2. Create the app shell in Intune
    app_id = _create_app_shell_for_library(
        display_name=display_name,
        description=description,
        publisher=publisher or "Unknown",
        installer_name=meta["file_name"], # Use the filename from the .intunewin metadata
        package_id=package_id, # App Library's ID
        detection_script=detection_script or "exit 0",
        install_command_override=install_command,
        uninstall_command_override=uninstall_command,
    )
    logger.info("Created App Library app shell. Intune App ID: %s", app_id)

    # 3. Create a content version for the app
    version_id = _create_content_version(app_id)
    logger.info("Created content version: %s", version_id)

    # 4. Create a file placeholder within the content version
    #    Use the `encrypted_content_path` for size calculation.
    file_placeholder = _create_file_placeholder(app_id, version_id, meta, encrypted_content_path)
    file_id = file_placeholder["id"]
    logger.info("Placeholder file created: %s", file_id)

    # 5. Wait for the Azure Storage URI to become available
    file_placeholder = _wait_for_storage_uri(app_id, version_id, file_id)
    sas_uri = file_placeholder["azureStorageUri"]

    # 6. Upload the *encrypted content* to Azure Blob Storage
    #    The `_upload_to_blob` function expects the path to the file to be uploaded.
    #    This is `encrypted_content_path` which was extracted by `_parse_detection_xml`.
    _upload_to_blob(encrypted_content_path, sas_uri)

    # 7. Commit the file upload
    _commit_file(app_id, version_id, file_id, meta) # meta contains encryption details

    # 8. Wait for the file commit to be processed by Intune
    _wait_for_commit(app_id, version_id, file_id)

    # 9. Commit the content version to make the app available
    _commit_content_version(app_id, version_id)

    # 10. Wait for the app to be published
    _wait_for_published(app_id)
    
    # Clean up the extracted encrypted content file
    if encrypted_content_path.exists():
        try:
            os.remove(encrypted_content_path)
            logger.info(f"Cleaned up temporary encrypted content file: {encrypted_content_path}")
        except OSError as e:
            logger.warning(f"Could not remove temporary encrypted content file {encrypted_content_path}: {e}")


    logger.info("App Library upload finished successfully. Intune App ID: %s", app_id)
    return app_id
