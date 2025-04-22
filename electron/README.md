# Intune Deployment App Electron Package

This directory contains the Electron wrapper for the Intune Deployment App, which bundles both the Next.js frontend and Python API into a single installable Windows application.

## Features

- Standalone Windows application with no external dependencies
- Embedded Python runtime and required packages
- Secure credential storage for Microsoft Graph API authentication
- Unified login interface that replaces `.env` configuration
- No separate API/frontend processes to manage - everything runs in one package

## Development Setup

### Prerequisites

- Node.js (v18+)
- npm or yarn
- Python 3.8+ (for development only)

### Initial Setup Process

1. Install frontend dependencies:

```bash
# Navigate to the frontend directory
cd /home/coder/Intune-Deployment-App/front-end
npm install
```

2. Install Electron dependencies:

```bash
# Navigate to the electron directory
cd /home/coder/Intune-Deployment-App/electron
npm install
```

### Running in Development Mode

After completing the initial setup, you can run the application in development mode from the electron directory:

```bash
# Make sure you're in the electron directory
cd /home/coder/Intune-Deployment-App/electron

# Start the application with hot-reloading
npm run dev
```

This single command will:
- Start the Next.js dev server for the frontend
- Launch Electron, which loads the frontend from the dev server
- Show the login screen to enter Microsoft Graph credentials
- After successful login, automatically start the Python API with your credentials
- Switch to the main application interface

You do NOT need to separately start the frontend or API - the Electron wrapper handles this automatically.

## Troubleshooting Development

If you encounter issues during development:

1. Check that both Next.js and Electron dependencies are installed
2. Ensure Python and required packages are available
3. Look for error messages in the Electron console (opened automatically in dev mode)
4. Verify your Microsoft Graph API credentials are correct

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
