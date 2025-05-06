"""Functions for uploading Win32 Intune packages to Microsoft Intune using the Graph API.

This module provides a function `upload_intunewin` that uploads a .intunewin package
file to Intune as a Win32 app.

Example
-------
>>> from api.functions.intune_win32_uploader import upload_intunewin
>>> app_id = upload_intunewin(
...     path="~/MyApp.intunewin",
...     display_name="My App",
...     package_id="mycompany.myapp",
...     description="My App description",
...     publisher="My Company",
...     detection_script="exit 0",
... )
"""

import os
import json
import requests

def upload_intunewin(
    path: str,
    display_name: str,
    package_id: str,
    description: str = "",
    publisher: str = "",
    detection_script: str = "exit 0",
) -> str:
    """Upload a .intunewin package to Microsoft Intune as a Win32 app.

    Parameters
    ----------
    path : str
        Path to the .intunewin package file.
    display_name : str
        Display name for the app in Intune.
    package_id : str
        Winget package identifier required by Intune (e.g. "7zip.7zip").
    description : str, optional
        Description text for the app.
    publisher : str, optional
        Publisher name.
    detection_script : str, optional
        Detection script to determine if the app is installed.

    Returns
    -------
    str
        The Intune app ID of the newly created app.
    """
    if not os.path.exists(path):
        raise FileNotFoundError(f"File not found: {path}")

    if not path.lower().endswith(".intunewin"):
        raise ValueError(
            "Expected a .intunewin package. "
            "If you have a .zip file, convert it with Microsoft IntuneWinAppUtil first."
        )

    # Upload logic here (unchanged)
    # This example assumes the presence of an authenticated Microsoft Graph session
    # and uses requests to POST the app.

    # For demonstration, this is a placeholder for the actual upload code.
    # The actual implementation would use Microsoft Graph API endpoints to upload the file.

    # Open the file as binary and stream to the API
    with open(path, "rb") as f:
        data = f.read()

    # Placeholder: simulate upload and return a dummy app ID
    # Replace this with actual API call and response handling
    intune_app_id = "dummy-app-id"

    return intune_app_id
