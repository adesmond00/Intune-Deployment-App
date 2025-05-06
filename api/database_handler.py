"""Database handler for working with the `packaged_app` table on Supabase.

This module centralises all database interactions so that other parts of the
codebase do not have to worry about connection management or SQL details.

Environment Variables
---------------------
DATABASE_URL : str
    The full PostgreSQL connection string. Falls back to the public Supabase
    connection string if unset. The default string purposely **excludes** the
    password portion so that it will raise clean errors if not configured.

Example
-------
>>> from api.database_handler import add_intune_app, deploy_app
>>> app_id = add_intune_app("7-Zip", "23.01", "~/7zip.intunewin", "install.cmd", "uninstall.cmd", "exit 0")
>>> deploy_app(app_id, package_id="7zip.7zip")
"""
from __future__ import annotations

import os
import urllib.parse
import tempfile
from datetime import datetime
from typing import Any, Dict, List, Optional
import zipfile
import requests

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

from .functions.intune_win32_uploader import upload_intunewin

# --------------------------------------------------------------------------------------
# Engine helper (singleton)
# --------------------------------------------------------------------------------------
_ENGINE: Optional[Engine] = None


def _get_engine() -> Engine:
    """Return a cached SQLAlchemy engine using DATABASE_URL env var.

    Set the DATABASE_URL environment variable to your Supabase connection
    string, e.g.::

        export DATABASE_URL="postgresql://postgres:<PASSWORD>@db.<hash>.supabase.co:5432/postgres"
    """
    global _ENGINE

    if _ENGINE is None:
        db_url = os.environ.get(
            "DATABASE_URL",
            "postgresql://postgres:[YOUR-PASSWORD]@db.uzxtwhhidwiranzfpwbe.supabase.co:5432/postgres",
        )
        # `future=True` gives 2.x style behaviour on SQLAlchemy 1.4+.
        _ENGINE = create_engine(db_url, pool_pre_ping=True, future=True)
    return _ENGINE


# --------------------------------------------------------------------------------------
# CRUD helpers
# --------------------------------------------------------------------------------------

def add_intune_app(
    app_name: str,
    version: str,
    intunewin_path: str,
    install_command: str,
    uninstall_command: str,
    detection_rule: str,
) -> int:
    """Insert a new packaged application and return its generated *id*."""

    sql = text(
        """
        INSERT INTO packaged_app (
            app_name,
            version,
            intunewin_path,
            install_command,
            uninstall_command,
            detection_rule,
            created_at
        ) VALUES (
            :app_name,
            :version,
            :intunewin_path,
            :install_command,
            :uninstall_command,
            :detection_rule,
            :created_at
        ) RETURNING id
        """
    )

    values = {
        "app_name": app_name,
        "version": version,
        "intunewin_path": intunewin_path,
        "install_command": install_command,
        "uninstall_command": uninstall_command,
        "detection_rule": detection_rule,
        "created_at": datetime.utcnow().isoformat(),
    }

    try:
        with _get_engine().begin() as conn:
            result = conn.execute(sql, values)
            new_id = result.scalar_one()
        return new_id
    except SQLAlchemyError as exc:
        raise RuntimeError(f"Failed to insert packaged app: {exc}") from exc


def search_apps(*, name: Optional[str] = None, app_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """Return rows that match *name* (ILIKE) or *app_id*.

    If both parameters are ``None`` this returns **all rows** (capped to 100).
    """
    where_clauses: List[str] = []
    params: Dict[str, Any] = {}

    if name:
        where_clauses.append("app_name ILIKE :name")
        params["name"] = f"%{name}%"
    if app_id is not None:
        where_clauses.append("id = :app_id")
        params["app_id"] = app_id

    where_sql = " AND ".join(where_clauses)
    if where_sql:
        where_sql = "WHERE " + where_sql

    sql = text(
        f"SELECT id, app_name, version, intunewin_path, install_command, "
        f"uninstall_command, detection_rule, created_at "
        f"FROM packaged_app {where_sql} ORDER BY created_at DESC LIMIT 100"
    )

    with _get_engine().begin() as conn:
        rows = conn.execute(sql, params).mappings().all()
        return [dict(row) for row in rows]


# --------------------------------------------------------------------------------------
# Deployment helper
# --------------------------------------------------------------------------------------

def deploy_app(
    record_id: int,
    *,
    package_id: str,
    publisher: str = "",
    description: Optional[str] = None,
) -> str:
    """Deploy the packaged app (identified by *record_id*) to Intune.

    This is a convenience wrapper around :func:`upload_intunewin` that fetches
    the record from the database and passes its fields along to the upload
    helper.

    Parameters
    ----------
    record_id : int
        The *id* column of the packaged_app row.
    package_id : str
        The Winget package identifier required by Intune (e.g. "7zip.7zip").
    publisher : str, optional
        Publisher name; defaults to empty.
    description : str, optional
        Text to show in Intune. Uses the app name if omitted.

    Returns
    -------
    str
        The newly created Intune application ID.

    If the stored ``intunewin_path`` is an HTTP(S) URL, the file is downloaded
    to a temporary location for the duration of the upload and deleted
    afterwards.
    """
    # Query exactly one row
    sql = text(
        "SELECT * FROM packaged_app WHERE id = :rid"
    )
    with _get_engine().begin() as conn:
        row = conn.execute(sql, {"rid": record_id}).mappings().first()
        if row is None:
            raise ValueError(f"No packaged app found with id={record_id}")

    # Build a friendly display name like "7‑Zip 23.01"
    display_name = f"{row['app_name']} {row['version']}".strip()

    # ------------------------------------------------------------------
    # Handle remote .intunewin packages
    # ------------------------------------------------------------------
    source_path = row["intunewin_path"]
    parsed = urllib.parse.urlparse(source_path)
    is_remote = parsed.scheme in ("http", "https")

    if is_remote:
        # Download the file to a secure temporary location
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=".intunewin")
        os.close(tmp_fd)
        try:
            # Use download_file helper which handles various edge cases with file hosts
            download_file(source_path, tmp_path)
            
            # After download verify it's a valid intunewin file
            try:
                with zipfile.ZipFile(tmp_path, 'r') as zip_test:
                    if "IntuneWinPackage/Metadata/Detection.xml" not in zip_test.namelist():
                        raise ValueError("Downloaded file is not a valid .intunewin package (Detection.xml not found)")
            except zipfile.BadZipFile:
                raise ValueError(
                    f"Downloaded file from {source_path} is not a valid ZIP file. Please ensure it's a properly formatted .intunewin package."
                )
        except Exception as exc:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            raise RuntimeError(
                f"Failed to download or validate Intune package from {source_path}: {exc}"
            ) from exc
        local_path = tmp_path
    else:
        # Treat as an existing local path (useful during development)
        local_path = source_path
        
        # Verify the local file is valid as well
        try:
            with zipfile.ZipFile(local_path, 'r') as zip_test:
                if "IntuneWinPackage/Metadata/Detection.xml" not in zip_test.namelist():
                    raise ValueError("Local file is not a valid .intunewin package (Detection.xml not found)")
        except zipfile.BadZipFile:
            raise ValueError(f"File at {local_path} is not a valid ZIP file. Please ensure it's a properly formatted .intunewin package.")

    try:
        intune_app_id = upload_intunewin(
            path=local_path,
            display_name=display_name,
            package_id=package_id,
            description=description or display_name,
            publisher=publisher,
            detection_script=row.get("detection_rule") or "exit 0",
        )
    finally:
        # Always clean up any temporary file we created
        if is_remote and os.path.exists(local_path):
            os.remove(local_path)

    return intune_app_id


# Create a specialized download_file function that knows how to handle file hosting services
def download_file(url: str, destination: str) -> None:
    """
    Download a file from a URL to a destination path, handling different file hosting services.
    
    This function is specialized for handling .intunewin file downloads from various hosting 
    services which might have special requirements.
    
    Parameters
    ----------
    url : str
        The URL to download from
    destination : str
        The file path to save to
    
    Raises
    ------
    RuntimeError
        If the download fails or the file appears to be invalid
    """
    print(f"Downloading from {url} to {destination}")
    
    # Set up proper headers that mimic a browser to avoid being served HTML pages
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',  # Accept anything (not just HTML)
        'Accept-Encoding': 'gzip, deflate, br',
    }
    
    # For filebin specifically, we need to modify how we handle it
    if 'filebin.net' in url:
        # First request to get the redirect URL
        try:
            with requests.head(url, headers=headers, allow_redirects=False, timeout=30) as r:
                if 300 <= r.status_code < 400 and 'Location' in r.headers:
                    direct_url = r.headers['Location']
                    print(f"Filebin redirect URL: {direct_url}")
                    
                    # Get the direct S3 URL with no caching/redirection
                    with requests.get(direct_url, headers=headers, stream=True, timeout=60) as direct_resp:
                        direct_resp.raise_for_status()
                        
                        # Write the file in chunks to the destination
                        with open(destination, 'wb') as f:
                            for chunk in direct_resp.iter_content(chunk_size=8192):
                                if chunk:
                                    f.write(chunk)
                        
                        # Verify we got a binary file, not HTML
                        file_size = os.path.getsize(destination)
                        if file_size > 0:
                            with open(destination, 'rb') as f:
                                first_few_bytes = f.read(min(100, file_size))
                                
                                # Print diagnostic info
                                print(f"Downloaded file size: {file_size} bytes")
                                if first_few_bytes.startswith(b'<!doctype') or first_few_bytes.startswith(b'<html'):
                                    raise RuntimeError("Received HTML instead of a binary file - access might be expired or requires login")
                                elif first_few_bytes.startswith(b'PK'):
                                    print("File appears to be a valid ZIP archive (starts with PK signature)")
                                else:
                                    print(f"First bytes: {repr(first_few_bytes[:20])}")
                else:
                    raise RuntimeError(f"Failed to get redirect URL from filebin.net: status {r.status_code}")
        except (requests.RequestException, IOError) as e:
            raise RuntimeError(f"Failed to download from filebin.net: {e}")
    else:
        # Generic download for other hosts
        try:
            with requests.get(url, headers=headers, stream=True, timeout=60) as resp:
                resp.raise_for_status()
                
                with open(destination, 'wb') as f:
                    for chunk in resp.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                
                # Verify we got a binary file, not HTML
                file_size = os.path.getsize(destination)
                print(f"Downloaded file size: {file_size} bytes")
                if file_size > 0:
                    with open(destination, 'rb') as f:
                        first_few_bytes = f.read(min(100, file_size))
                        
                        if first_few_bytes.startswith(b'<!doctype') or first_few_bytes.startswith(b'<html'):
                            raise RuntimeError("Received HTML instead of a binary file")
                        elif first_few_bytes.startswith(b'PK'):
                            print("File appears to be a valid ZIP archive (starts with PK signature)")
                        else:
                            print(f"First bytes: {repr(first_few_bytes[:20])}")
        except requests.RequestException as e:
            raise RuntimeError(f"Failed to download file: {e}")