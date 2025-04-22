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
import math
import os
import time
import uuid
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Dict, Tuple

import requests
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

from api.functions.auth import get_auth_headers  # your existing helper


GRAPH_BASE = "https://graph.microsoft.com/beta"  # use v1.0 if you prefer


# --------------------------------------------------------------------------------------
# 1.  ── helper: read metadata & decrypt payload inside the .intunewin
# --------------------------------------------------------------------------------------
def _parse_detection_xml(intunewin: Path) -> Tuple[Dict, Path]:
    """Return encryption metadata + path to decrypted payload ZIP."""
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
    # decrypt to <package>.decoded
    decrypted_path = intunewin.with_suffix(".decoded")
    _decrypt_file(
        Path(encrypted_blob),
        decrypted_path,
        base64.b64decode(meta["encryption_key"]),
        base64.b64decode(meta["iv"]),
    )

    # compute digest if missing
    if not meta["file_digest"]:
        h = hashlib.sha256()
        with open(decrypted_path, "rb") as fh:
            for chunk in iter(lambda: fh.read(2 << 20), b""):
                h.update(chunk)
        meta["file_digest"] = base64.b64encode(h.digest()).decode()

    return meta, decrypted_path


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
    resp = requests.request(method, url, headers=headers, **kwargs)
    try:
        resp.raise_for_status()
    except requests.HTTPError as exc:
        # Surface error details from Graph for easier troubleshooting
        raise requests.HTTPError(f"{exc}\n{resp.text}") from None
    return resp.json() if resp.content else None


def _create_app_shell(display_name: str, publisher: str, installer_name: str) -> str:
    body = {
        "@odata.type": "#microsoft.graph.win32LobApp",
        "displayName": display_name,
        "description": display_name,
        "publisher": publisher,
        "fileName": installer_name,
        "setupFilePath": installer_name,
        "installCommandLine": installer_name,
        "uninstallCommandLine": "echo uninstall‑stub",
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


def _create_file_placeholder(app_id: str, version_id: str, meta: Dict) -> Dict:
    body = {
        "@odata.type": "#microsoft.graph.mobileAppContentFile",
        "name": meta["file_name"],
        "size": meta["unencrypted_size"],
        "sizeEncrypted": os.path.getsize(meta["file_name"]) if os.path.exists(meta["file_name"]) else meta["unencrypted_size"],
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
    for _ in range(timeout // 10):
        data = _graph_request("GET", url)
        if data.get("isCommitted"):
            return
        time.sleep(10)
    raise TimeoutError("Timed out waiting for file commit")


# --------------------------------------------------------------------------------------
# 3.  ── upload helper (Azure BlockBlob over raw HTTP – no SDK dependency)
# --------------------------------------------------------------------------------------
def _upload_to_blob(decrypted_file: Path, sas_uri: str, block_size=4 * 1024 * 1024):
    total = os.path.getsize(decrypted_file)
    blocks = []

    with open(decrypted_file, "rb") as fh:
        idx = 0
        while chunk := fh.read(block_size):
            block_id = base64.b64encode(f"{idx:05}".encode()).decode()
            params = {"comp": "block", "blockid": block_id}
            requests.put(sas_uri, params=params, data=chunk).raise_for_status()
            blocks.append(block_id)
            idx += 1

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
    publisher: str = "",
) -> str:
    """
    End‑to‑end helper.

    Returns
    -------
    The new mobileApp (Win32 LOB) ID.
    """
    intunewin = Path(path).expanduser().resolve()
    meta, decrypted = _parse_detection_xml(intunewin)

    app_id = _create_app_shell(display_name, publisher or "Unknown", meta["file_name"])
    version_id = _create_content_version(app_id)
    ph = _create_file_placeholder(app_id, version_id, meta)
    ph = _wait_for_storage_uri(app_id, version_id, ph["id"])
    _upload_to_blob(decrypted, ph["azureStorageUri"])
    _commit_file(app_id, version_id, ph["id"], meta)
    _wait_for_commit(app_id, version_id, ph["id"])

    return app_id