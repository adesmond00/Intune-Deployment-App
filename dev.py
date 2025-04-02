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
        sys.exit(1)

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
    print("\nInstalling frontend dependencies...")
    frontend_dir = Path("Front-end")
    
    # Check if node_modules exists
    if not (frontend_dir / "node_modules").exists():
        print("Installing npm dependencies...")
        run_command(["npm", "install"], cwd=frontend_dir)
    else:
        print("Frontend dependencies already installed")

def install_backend_dependencies():
    """Install backend dependencies using pip."""
    print("\nInstalling backend dependencies...")
    api_dir = Path("api")
    
    # Check if requirements.txt exists
    if (api_dir / "requirements.txt").exists():
        print("Installing Python dependencies...")
        run_command([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], cwd=api_dir)
    else:
        print("No requirements.txt found in api directory")

def start_development_servers():
    """Start both frontend and backend servers in development mode."""
    print("\nStarting development servers...")
    
    # Start backend server
    api_dir = Path("api")
    backend_process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "api:app", "--reload", "--port", "8000"],
        cwd=api_dir
    )
    
    # Wait a moment for backend to start
    time.sleep(2)
    
    # Start frontend server
    frontend_dir = Path("Front-end")
    frontend_process = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=frontend_dir
    )
    
    # Wait a moment for frontend to start
    time.sleep(2)
    
    # Open the application in the default browser
    webbrowser.open("http://localhost:5173")
    
    print("\nDevelopment servers started!")
    print("Frontend: http://localhost:5173")
    print("Backend: http://localhost:8000")
    print("\nPress Ctrl+C to stop the servers")
    
    try:
        # Wait for both processes
        backend_process.wait()
        frontend_process.wait()
    except KeyboardInterrupt:
        print("\nShutting down servers...")
        backend_process.terminate()
        frontend_process.terminate()
        print("Servers stopped")

def main():
    """Main entry point for the development setup script."""
    print("Setting up Intune Deployment Toolkit development environment...")
    
    # Check Python version
    check_python_version()
    
    # Install dependencies
    install_frontend_dependencies()
    install_backend_dependencies()
    
    # Start development servers
    start_development_servers()

if __name__ == "__main__":
    main() 