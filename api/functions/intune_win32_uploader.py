"""
High‑level helper for uploading a .intunewin package and creating
a Win32 LOB application in Intune.

Requirements
------------
pip install requests cryptography azure-storage-blob python-dotenv
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
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

# Change from absolute import to relative import to fix circular reference
from .auth import get_auth_headers  # Use relative import


logger = logging.getLogger(__name__)
if not logger.handlers:
    # default to INFO level if the parent application hasn't configured logging
    logging.basicConfig(level=logging.INFO)


GRAPH_BASE = "https://graph.microsoft.com/beta"  # use v1.0 if you prefer


# --------------------------------------------------------------------------------------
# 1.  ── helper: read metadata & decrypt payload inside the .intunewin
# --------------------------------------------------------------------------------------
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

        # encrypted blob lives under Contents/<file_name>
        encrypted_blob = zf.extract(
            f"IntuneWinPackage/Contents/{meta['file_name']}",
            path=intunewin.parent,
        )
    return meta, Path(encrypted_blob)


def _decrypt_file(src: Path, dst: Path, key: bytes, iv: bytes) -> None:
    """AES‑CBC decrypt skipping the 48‑byte staging header (same trick as IntuneWin util)."""
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
    decryptor = cipher.decryptor()

    with open(src, "rb") as fin, open(dst, "wb") as fout:
        fin.seek(48)  # Intune staging header
        for chunk in iter(lambda: fin.read(2 << 20), b""):
            fout.write(decryptor.update(chunk))
        fout.write(decryptor.finalize())


# --------------------------------------------------------------------------------------
# 2.  ── graph helpers
# --------------------------------------------------------------------------------------
def _graph_request(method: str, url: str, **kwargs):
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
        # Surface error details from Graph for easier troubleshooting
        raise requests.HTTPError(f"{exc}\n{resp.text}") from None
    return resp.json() if resp.content else None


def _create_app_shell(display_name: str, description: Optional[str], publisher: str, installer_name: str, package_id: str) -> str:
    if not description:
        description = display_name
    # Build install/uninstall command lines based on PackageID and display name
    log_basename = re.sub(r'\W+', '', display_name) or "Package"
    log_file = f"{log_basename}.log"
    install_cmd = (
        f'powershell.exe -executionpolicy bypass '
        f'-file Winget-InstallPackage.ps1 -mode install '
        f'-PackageID "{package_id}" -Log "{log_file}"'
    )
    uninstall_cmd = install_cmd.replace("-mode install", "-mode uninstall")

    body = {
        "@odata.type": "#microsoft.graph.win32LobApp",
        "displayName": display_name,
        "description": description,
        "publisher": publisher,
        "fileName": installer_name,
        "setupFilePath": installer_name,
        "installCommandLine": install_cmd,
        "uninstallCommandLine": uninstall_cmd,
        "applicableArchitectures": "x64",
        "minimumSupportedWindowsRelease": "1607",
        "rules": [
            {
                "@odata.type": "#microsoft.graph.win32LobAppPowerShellScriptRule",
                "ruleType": "detection",
                "enforceSignatureCheck": False,
                "runAs32Bit": False,
                "scriptContent": base64.b64encode(b"exit 0").decode(),
                "operationType": "notConfigured",
                "operator": "notConfigured"
            }
        ],
        "installExperience": {"@odata.type": "#microsoft.graph.win32LobAppInstallExperience",
                              "runAsAccount": "system",
                              "deviceRestartBehavior": "suppress"},
        "returnCodes": [{"@odata.type": "#microsoft.graph.win32LobAppReturnCode",
                         "returnCode": 0, "type": "success"}]
    }
    result = _graph_request("POST", f"{GRAPH_BASE}/deviceAppManagement/mobileApps", json=body)
    return result["id"]


def _create_content_version(app_id: str) -> str:
    result = _graph_request(
        "POST",
        f"{GRAPH_BASE}/deviceAppManagement/mobileApps/{app_id}"
        "/microsoft.graph.win32LobApp/contentVersions",
        json={}
    )
    return result["id"]


def _create_file_placeholder(app_id: str, version_id: str, meta: Dict, encrypted_path: Path) -> Dict:
    body = {
        "@odata.type": "#microsoft.graph.mobileAppContentFile",
        "name": meta["file_name"],
        "size": meta["unencrypted_size"],
        "sizeEncrypted": os.path.getsize(encrypted_path),
        "isDependency": False,
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
    for _ in range(timeout // 5):
        data = _graph_request("GET", url)
        if data.get("azureStorageUri"):
            return data
        time.sleep(5)
    raise TimeoutError("Timed out waiting for AzureStorageUri")


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


def _commit_content_version(app_id: str, version_id: str):
    """
    Finalize the content version after all files are committed.
    Without this call the mobileApp remains 'notPublished'.
    """
    logger.info("Committing content version %s to the mobileApp…", version_id)
    body = {
        "@odata.type": "#microsoft.graph.win32LobApp",
        "committedContentVersion": version_id
    }
    _graph_request(
        "PATCH",
        f"{GRAPH_BASE}/deviceAppManagement/mobileApps/{app_id}",
        json=body
    )


def _wait_for_commit(app_id: str, version_id: str, file_id: str, timeout=600):
    url = (f"{GRAPH_BASE}/deviceAppManagement/mobileApps/{app_id}"
           f"/microsoft.graph.win32LobApp/contentVersions/{version_id}/files/{file_id}")
    logger.info("Waiting for Intune to finish processing the file commit...")
    for _ in range(timeout // 10):
        data = _graph_request("GET", url)
        # Verbose progress logging
        logger.info(
            "Commit poll → isCommitted=%s  uploadState=%s  size=%s",
            data.get("isCommitted"),
            data.get("uploadState", "n/a"),
            data.get("size")
        )
        logger.debug("Full commit poll payload: %s", json.dumps(data)[:1000])
        if data.get("uploadState") == "commitFileFailed":
            raise RuntimeError(f"Intune reported commit failure: {json.dumps(data)[:1000]}")
        if data.get("isCommitted"):
            logger.info("File commit completed!")
            return
        time.sleep(10)
    raise TimeoutError("Timed out waiting for file commit")


# --------------------------------------------------------------------------------------
# 3.  ── upload helper (Azure BlockBlob over raw HTTP – no SDK dependency)
# --------------------------------------------------------------------------------------

def _wait_for_published(app_id: str, timeout=900):
    """
    Poll the mobileApp object until Intune finishes backend processing
    (publishingState == 'published') or until timeout is reached.
    """
    url = f"{GRAPH_BASE}/deviceAppManagement/mobileApps/{app_id}"
    logger.info("Waiting for Intune to publish the app …")
    for _ in range(timeout // 10):
        data = _graph_request("GET", url)  # full object; not all tenants expose processingState
        logger.info(
            "Publish poll → publishingState=%s",
            data.get("publishingState")
        )
        logger.debug("Full publish poll payload: %s", json.dumps(data)[:1000])
        if data.get("publishingState") == "published":
            logger.info("App is now published and ready!")
            return
        time.sleep(10)
    raise TimeoutError("Timed out waiting for publishingState='published'")


# --------------------------------------------------------------------------------------
# 3.  ── upload helper (Azure BlockBlob over raw HTTP – no SDK dependency)
# --------------------------------------------------------------------------------------
def _upload_to_blob(payload_file: Path, sas_uri: str, block_size=4 * 1024 * 1024):
    total = os.path.getsize(payload_file)
    blocks = []

    logger.info("Uploading decrypted payload to Azure Blob (%s bytes)...", total)
    with open(payload_file, "rb") as fh:
        idx = 0
        while chunk := fh.read(block_size):
            block_id = base64.b64encode(f"{idx:05}".encode()).decode()
            params = {"comp": "block", "blockid": block_id}
            requests.put(sas_uri, params=params, data=chunk).raise_for_status()
            blocks.append(block_id)
            idx += 1
    logger.info("Upload complete, committing block list...")

    # commit the block list
    block_list_xml = (
        '<?xml version="1.0" encoding="utf-8"?><BlockList>'
        + "".join(f"<Latest>{b}</Latest>" for b in blocks)
        + "</BlockList>"
    )
    requests.put(sas_uri, params={"comp": "blocklist"}, data=block_list_xml,
                 headers={"Content-Type": "application/xml"}).raise_for_status()


# --------------------------------------------------------------------------------------
# 4.  ── public one‑liner
# --------------------------------------------------------------------------------------
def upload_intunewin(
    path: str | Path,
    display_name: str,
    package_id: str,
    description: Optional[str] = None,
    publisher: str = "",
) -> str:
    """
    End‑to‑end helper.

    Parameters
    ----------
    description : str, optional
        Descriptive text shown in Intune. Defaults to display_name if omitted.
    package_id : str
        The Winget package identifier.

    Returns
    -------
    The new mobileApp (Win32 LOB) ID.
    """
    logger.info("Starting Win32 upload: %s → '%s'", path, display_name)
    intunewin = Path(path).expanduser().resolve()
    meta, encrypted = _parse_detection_xml(intunewin)

    app_id = _create_app_shell(display_name, description, publisher or "Unknown", meta["file_name"], package_id)
    logger.info("Created app shell. ID: %s", app_id)
    version_id = _create_content_version(app_id)
    logger.info("Created content version: %s", version_id)
    ph = _create_file_placeholder(app_id, version_id, meta, encrypted)
    logger.info("Placeholder file created: %s", ph["id"])
    ph = _wait_for_storage_uri(app_id, version_id, ph["id"])
    _upload_to_blob(encrypted, ph["azureStorageUri"])
    _commit_file(app_id, version_id, ph["id"], meta)
    _wait_for_commit(app_id, version_id, ph["id"])
    _commit_content_version(app_id, version_id)
    _wait_for_published(app_id)

    logger.info("Upload finished successfully. App ID: %s", app_id)
    return app_id