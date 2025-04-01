# Technical Context: Intune Deployment Toolkit

## Frontend (`Front-end/`)
*   **Framework/Library**: React (^18.2.0)
*   **Language**: TypeScript (^5.0.2)
*   **Build Tool**: Vite (^4.5.0)
*   **Styling**: TailwindCSS (^3.3.3) with PostCSS (^8.4.31) and Autoprefixer (^10.4.14)
*   **Package Manager**: npm (inferred from `package-lock.json`)
*   **Entry Point**: `src/main.tsx`
*   **Main Component**: `src/App.tsx`

## Backend API (`api/`)
*   **Language**: Python (Version not specified, assume Python 3+)
*   **Framework**: FastAPI (>=0.110.0)
*   **Web Server**: Uvicorn (>=0.27.1) for running FastAPI
*   **Data Validation**: Pydantic (>=2.6.1)
*   **Dependencies**: Listed in `api/requirements.txt`
*   **Key Modules**:
    *   `api.py`: Main FastAPI application definition, endpoints.
    *   `winget.py`: Contains logic for interacting with `winget.exe` search.
*   **Entry Point**: `api/api.py` (when run with `uvicorn`)

## Scripting (`scripts/`)
*   **Language**: PowerShell
*   **Key Modules Used**:
    *   `IntuneWin32App`: For packaging (`.intunewin`) and adding Win32 apps to Intune. (Used in `Connect-to-Intune.ps1`, `Package-MSI.ps1`, `Add-App-to-Intune.ps1`)
    *   `Microsoft.Graph.Intune`: For connecting to and interacting with the Intune service via Microsoft Graph API. (Used in `Connect-to-Intune.ps1`)
*   **External Tools**:
    *   `winget.exe`: Windows Package Manager command-line tool. Used for searching (`api/winget.py`) and installing/uninstalling (`scripts/Winget-InstallPackage.ps1`). The `Winget-InstallPackage.ps1` script includes logic to download and set up `winget` if it's not found.
    *   `7zip` (specifically `7zr.exe`, `7za.exe`): Used within `Winget-InstallPackage.ps1` to extract the `winget` MSIX bundle if needed.
*   **Execution Context**: Scripts are designed to be executed via PowerShell, potentially invoked by the Python backend. `Winget-InstallPackage.ps1` includes logic to re-launch itself as a 64-bit process and assumes it might run in the SYSTEM context (common for Intune deployments).

## Operating System Context
*   The reliance on PowerShell, Intune modules, `winget.exe`, and Win32 app packaging implies the primary target and development environment is **Windows**.
*   The FastAPI backend can run cross-platform, but its utility is tied to executing Windows-specific PowerShell scripts.
*   The React frontend is cross-platform and accessed via a web browser.

## Development Setup Considerations
*   Frontend: Requires Node.js and npm installed. Run `npm install` in `Front-end/` then `npm run dev`.
*   Backend: Requires Python 3 and pip. Run `pip install -r api/requirements.txt` in `api/`, then run `uvicorn api:app --reload` from the `api/` directory.
*   Scripts: Require a Windows environment with PowerShell. Modules might need installation (`Install-Module`). Running scripts might require appropriate execution policies (`Set-ExecutionPolicy`) or bypassing (`-ExecutionPolicy Bypass`). Administrator privileges might be needed for module installation and certain Intune/winget operations.
