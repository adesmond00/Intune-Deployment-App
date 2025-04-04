# Intune Deployment Toolkit

A modern web application for managing Intune deployments and configurations. This toolkit provides a user-friendly interface for executing PowerShell commands, managing Intune configurations, and deploying applications.

## Features

- Interactive PowerShell command execution
- Intune session management
- Application deployment management
- Modern, responsive UI
- Secure authentication with Azure AD
- Persistent session handling

## Prerequisites

- Python 3.12 or higher
- Node.js 18 or higher
- Azure AD app registration
- PowerShell 7 or higher
- Intune administrator access

## Project Structure

```
Intune-Deployment-App/
├── Front-end/          # React frontend application
├── api/               # FastAPI backend
├── scripts/           # PowerShell scripts
└── memory-bank/       # Configuration and state storage
```

## Setup Instructions

### 1. Backend Setup

1. Navigate to the `api` directory:
   ```bash
   cd api
   ```

2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Update the following variables:
     ```
     AZURE_CLIENT_ID=your_client_id
     AZURE_TENANT_ID=your_tenant_id
     AZURE_CLIENT_SECRET=your_client_secret
     ITSANGEROUS_SECRET_KEY=your_secret_key
     ```

### 2. Frontend Setup

1. Navigate to the `Front-end` directory:
   ```bash
   cd Front-end
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   - Create a `.env` file
   - Add the following:
     ```
     VITE_API_BASE_URL=http://localhost:8000
     ```

### 3. Azure AD Configuration

1. Register a new application in Azure AD
2. Configure the following redirect URI:
   ```
   http://localhost:8000/auth/callback
   ```
3. Add the following API permissions:
   - Microsoft Graph API
     - Application permissions:
       - DeviceManagementApps.ReadWrite.All
       - DeviceManagementConfiguration.ReadWrite.All
       - DeviceManagementServiceConfig.ReadWrite.All

## Running the Application

### Start the Backend

1. Navigate to the `api` directory
2. Activate the virtual environment
3. Start the server:
   ```bash
   uvicorn api:app --reload
   ```

### Start the Frontend

1. Navigate to the `Front-end` directory
2. Start the development server:
   ```bash
   npm run dev
   ```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000

## Usage

1. Open the application in your browser
2. Click "Connect" to authenticate with Azure AD
3. Once authenticated, you can:
   - Execute PowerShell commands
   - Manage Intune configurations
   - Deploy applications
   - View and manage deployment status

## Security Considerations

- Never commit sensitive credentials to version control
- Use environment variables for all secrets
- Regularly rotate Azure AD client secrets
- Keep dependencies updated
- Use HTTPS in production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue in the GitHub repository.