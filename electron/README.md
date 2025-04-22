# Intune Deployment App Electron Package

This directory contains the Electron wrapper for the Intune Deployment App, which bundles both the Next.js frontend and Python API into a single installable Windows application.

## Features

- Standalone Windows application with no external dependencies
- Embedded Python runtime and required packages
- Secure credential storage for Microsoft Graph API authentication
- Unified login interface that replaces `.env` configuration
- No separate API/frontend processes to manage

## Development Setup

### Prerequisites

- Node.js (v18+)
- npm or yarn
- Python 3.8+ (for development only)

### Running in Development Mode

1. Install dependencies:

```bash
# Install frontend dependencies
cd ../front-end
npm install

# Install Electron dependencies
cd ../electron
npm install
```

2. Start the application in development mode:

```bash
# Start the application with hot-reloading
npm run dev
```

This will:
- Start the Next.js dev server on port 3000
- Launch Electron pointing to the dev server
- Load the Python API dynamically based on login credentials

## Building for Production

### Building the Windows Installer

To create a production-ready Windows installer:

1. Ensure you have all prerequisites installed
2. Run the build script:

```bash
# From the electron directory
node build-windows.js
```

The build script will:
- Build and export the Next.js frontend
- Set up the embedded Python environment
- Package the app using electron-builder
- Create an installer in the `dist` folder

### Testing on Windows

After building, you can test the installer on a Windows machine:

1. Run the `.exe` installer from the `dist` folder
2. Complete the installation process
3. Launch the app from the Start menu or desktop shortcut
4. Enter your Microsoft Graph API credentials on the login screen

## Architecture

The Electron app consists of three main components:

1. **Electron Main Process** (`main.js`):
   - Manages the application lifecycle
   - Handles authentication and secure credential storage
   - Spawns and manages the Python API process
   - Communicates with the renderer process via IPC

2. **Next.js Frontend** (from `../front-end`):
   - Provides the user interface
   - Communicates with the Python API for business logic
   - Integrates with Electron via the preload script

3. **Python API** (from `../api`):
   - Handles business logic and Microsoft Graph API communication
   - Runs as a child process within Electron
   - Receives authentication from stored credentials

## Authentication Flow

1. User launches the app for the first time
2. Login screen prompts for Microsoft Graph API credentials:
   - Client ID
   - Client Secret
   - Tenant ID
3. Credentials are securely stored using `electron-store` with encryption
4. Python API is started with credentials as environment variables
5. On subsequent launches, stored credentials are used automatically

## Notes for Windows Deployment

- The application requires administrative privileges during installation
- The embedded Python environment is isolated and won't conflict with existing Python installations
- All dependencies are bundled within the application
