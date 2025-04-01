# Product Context: Intune Deployment Toolkit

## Problem Solved
Deploying traditional Win32 applications (like `.exe` and `.msi` installers) via Microsoft Intune requires several manual steps:
1.  Packaging the application into the `.intunewin` format using the Microsoft Win32 Content Prep Tool.
2.  Uploading the `.intunewin` file to Intune.
3.  Configuring various deployment parameters within the Intune portal, including:
    *   Application metadata (name, description, publisher).
    *   Installation and uninstallation command lines.
    *   Detection rules (to determine if the app is already installed).
    *   Requirement rules (OS version, architecture, etc.).
    *   Return code handling.
    *   Assignment to user/device groups.

This process can be time-consuming, error-prone, and requires familiarity with both the application being packaged and Intune's specific requirements. This toolkit aims to automate and simplify this workflow.

## Target Users
The primary users are IT administrators or deployment engineers responsible for managing application deployments within an organization using Microsoft Intune.

## Intended Workflow
The envisioned user workflow is as follows:
1.  **Launch**: The user opens the web interface (React frontend).
2.  **Application Selection/Search**: The user might search for applications using an integrated `winget` search feature or provide details for a custom application (e.g., path to an MSI/EXE installer).
3.  **Configuration**: The user configures the packaging and deployment settings through the UI:
    *   Specifies installer file location.
    *   Defines application metadata (name, publisher, description).
    *   Sets install/uninstall commands (potentially auto-populated for common installer types).
    *   Configures detection methods (e.g., MSI product code, file/registry checks).
    *   Sets requirement rules (OS version, disk space, etc.).
4.  **Packaging & Upload**: The user initiates the process. The backend API triggers PowerShell scripts to:
    *   Package the application into the `.intunewin` format.
    *   Upload the `.intunewin` file to Intune.
    *   Create the Win32 application entry in Intune with all the configured settings.
5.  **Status/Feedback**: The UI provides feedback on the progress and success/failure of the operation.
6.  **Assignment (Optional)**: Future enhancements might allow assigning the application to groups directly from the toolkit, although initially, this might still be done via the Intune portal.

The goal is to provide a guided, streamlined experience that abstracts away much of the underlying complexity of the `IntuneWin32App` module and the Content Prep Tool.
