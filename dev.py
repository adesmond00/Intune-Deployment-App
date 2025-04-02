#!/usr/bin/env python3
"""
Development setup script for Intune Deployment Toolkit.

This script handles:
1. Installing frontend dependencies (npm)
2. Installing backend dependencies (pip)
3. Starting both frontend and backend servers in development mode
"""

import os
import sys
import subprocess
import time
import webbrowser
import signal
import platform
from pathlib import Path

def run_command(command, cwd=None, shell=False):
    """Run a command and return its output."""
    try:
        result = subprocess.run(
            command,
            cwd=cwd,
            shell=shell,
            check=True,
            capture_output=True,
            text=True
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {' '.join(command) if isinstance(command, list) else command}")
        print(f"Error: {e.stderr}")
        raise

def check_python_version():
    """Check if Python version meets requirements."""
    required_version = (3, 8)
    current_version = sys.version_info[:2]
    if current_version < required_version:
        print(f"Error: Python {required_version[0]}.{required_version[1]} or higher is required")
        print(f"Current version: {current_version[0]}.{current_version[1]}")
        sys.exit(1)

def install_frontend_dependencies():
    """Install frontend dependencies using npm."""
    frontend_dir = Path("Front-end")
    if not frontend_dir.exists():
        print("Error: Front-end directory not found")
        sys.exit(1)

    print("\nInstalling frontend dependencies...")
    node_modules = frontend_dir / "node_modules"
    
    if not node_modules.exists():
        print("Installing npm dependencies...")
        run_command(["npm", "install"], cwd=frontend_dir)
    else:
        print("Frontend dependencies already installed")

def install_backend_dependencies():
    """Install backend dependencies using pip."""
    print("\nInstalling backend dependencies...")
    requirements_file = Path("api/requirements.txt")
    
    if not requirements_file.exists():
        print("Error: requirements.txt not found in api directory")
        sys.exit(1)

    print("Installing Python dependencies...")
    run_command([sys.executable, "-m", "pip", "install", "-r", str(requirements_file)])

def start_development_servers():
    """Start both frontend and backend servers in development mode."""
    print("\nStarting development servers...")
    
    # Get absolute paths
    frontend_dir = Path("Front-end").resolve()
    api_dir = Path("api").resolve()
    
    # Start backend server
    backend_process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "api:app", "--reload"],
        cwd=api_dir,
        creationflags=subprocess.CREATE_NEW_CONSOLE if platform.system() == "Windows" else 0
    )
    
    # Wait for backend to start
    time.sleep(2)
    
    # Start frontend server
    frontend_process = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=frontend_dir,
        creationflags=subprocess.CREATE_NEW_CONSOLE if platform.system() == "Windows" else 0
    )
    
    # Wait for frontend to start
    time.sleep(5)
    
    # Open the application in the default browser
    webbrowser.open("http://localhost:5173")
    
    try:
        # Wait for both processes
        backend_process.wait()
        frontend_process.wait()
    except KeyboardInterrupt:
        print("\nShutting down servers...")
        backend_process.terminate()
        frontend_process.terminate()
        backend_process.wait()
        frontend_process.wait()
        print("Servers stopped")

def main():
    """Main entry point for the development setup script."""
    print("Setting up Intune Deployment Toolkit development environment...")
    
    try:
        # Check Python version
        check_python_version()
        
        # Install dependencies
        install_frontend_dependencies()
        install_backend_dependencies()
        
        # Start development servers
        start_development_servers()
    except Exception as e:
        print(f"\nError: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main() 