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

def verify_directory_structure():
    """Verify that all required directories and files exist."""
    print("\nVerifying directory structure...")
    required_paths = {
        "Front-end": "Frontend directory",
        "Front-end/package.json": "Frontend package.json",
        "api": "API directory",
        "api/api.py": "Main API file",
        "api/requirements.txt": "Python requirements file"
    }
    
    missing_paths = []
    for path_str, description in required_paths.items():
        path_obj = Path(path_str)
        if not path_obj.exists():
            missing_paths.append(f"{description} ({path_obj.resolve()})")
            print(f"  [FAIL] {description} not found at: {path_obj.resolve()}")
        else:
            print(f"  [ OK ] {description} found at: {path_obj.resolve()}")
    
    if missing_paths:
        print("\nError: Missing required files or directories.")
        print("Please ensure you're running this script from the project root directory and all files are present.")
        sys.exit(1)
    print("Directory structure verified.")

def run_command(command, cwd=None, shell=False):
    """Run a command and return its output."""
    try:
        # On Windows, sometimes shell=True is needed for npm/node commands
        use_shell = shell or (platform.system() == "Windows")
        print(f"Running command: {' '.join(command) if isinstance(command, list) else command} in {cwd} (shell={use_shell})")
        result = subprocess.run(
            command,
            cwd=cwd,
            shell=use_shell, # Use shell=True on Windows
            check=True,
            capture_output=True,
            text=True,
            encoding='utf-8' # Specify encoding
        )
        print(f"Command output: {result.stdout[:200]}...") # Print partial output
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {' '.join(command) if isinstance(command, list) else command}")
        print(f"Return code: {e.returncode}")
        print(f"Stdout: {e.stdout}")
        print(f"Stderr: {e.stderr}")
        raise
    except FileNotFoundError as e:
        print(f"Error: Command or file not found. Please ensure the required tools (like node, npm, python) are installed and in your system's PATH.")
        print(f"Command attempted: {' '.join(command) if isinstance(command, list) else command}")
        print(f"Working directory: {cwd}")
        print(f"Details: {str(e)}")
        raise

def check_python_version():
    """Check if Python version meets requirements."""
    print("\nChecking Python version...")
    required_version = (3, 8)
    current_version = sys.version_info[:2]
    if current_version < required_version:
        print(f"Error: Python {required_version[0]}.{required_version[1]} or higher is required")
        print(f"Current version: {current_version[0]}.{current_version[1]}")
        sys.exit(1)
    print(f"Python version: {platform.python_version()} [OK]")

def check_node_version():
    """Check if Node.js and npm are installed and meets requirements."""
    print("\nChecking Node.js and npm versions...")
    try:
        node_version = run_command(["node", "--version"])
        print(f"Node.js version: {node_version.strip()} [OK]")
    except FileNotFoundError:
        print("Error: Node.js is not installed or not found in PATH. Please install Node.js and try again.")
        sys.exit(1)
    except Exception as e:
        print(f"Error checking Node.js version: {e}")
        sys.exit(1)

    try:
        npm_version = run_command(["npm", "--version"])
        print(f"npm version: {npm_version.strip()} [OK]")
    except FileNotFoundError:
        print("Error: npm is not installed or not found in PATH. Please ensure Node.js installation includes npm and it's in PATH.")
        sys.exit(1)
    except Exception as e:
        print(f"Error checking npm version: {e}")
        sys.exit(1)

def install_frontend_dependencies():
    """Install frontend dependencies using npm."""
    frontend_dir = Path("Front-end").resolve()
    print(f"\nChecking frontend dependencies in: {frontend_dir}")
    
    node_modules = frontend_dir / "node_modules"
    package_lock = frontend_dir / "package-lock.json"
    
    # Check if installation is needed (no node_modules or package-lock.json is newer than node_modules)
    needs_install = not node_modules.exists()
    if not needs_install and package_lock.exists() and node_modules.exists():
        try:
            if package_lock.stat().st_mtime > node_modules.stat().st_mtime:
                print("package-lock.json is newer than node_modules, reinstalling dependencies.")
                needs_install = True
        except FileNotFoundError:
             needs_install = True # If node_modules doesn't actually exist

    if needs_install:
        print("Installing npm dependencies...")
        run_command(["npm", "install"], cwd=frontend_dir)
    else:
        print("Frontend dependencies appear up to date.")

def install_backend_dependencies():
    """Install backend dependencies using pip."""
    print("\nChecking backend dependencies...")
    requirements_file = Path("api/requirements.txt").resolve()
    print(f"Using requirements file: {requirements_file}")

    print("Installing Python dependencies...")
    # Consider adding a check similar to frontend to see if install is needed
    run_command([sys.executable, "-m", "pip", "install", "--upgrade", "pip"]) # Ensure pip is up-to-date
    run_command([sys.executable, "-m", "pip", "install", "-r", str(requirements_file)])
    print("Backend dependencies installed.")

def start_development_servers():
    """Start both frontend and backend servers in development mode."""
    print("\nStarting development servers...")
    
    # Get absolute paths
    frontend_dir = Path("Front-end").resolve()
    api_dir = Path("api").resolve()
    
    print(f"Backend API directory: {api_dir}")
    print(f"Frontend directory: {frontend_dir}")
    
    # Verify paths exist (redundant with verify_directory_structure but good safety check)
    if not api_dir.exists():
        print(f"Error: API directory not found at {api_dir}")
        sys.exit(1)
    if not frontend_dir.exists():
        print(f"Error: Frontend directory not found at {frontend_dir}")
        sys.exit(1)
    
    backend_process = None
    frontend_process = None

    try:
        # Start backend server
        print(f"Starting backend server in {api_dir}...")
        backend_cmd = [sys.executable, "-m", "uvicorn", "api:app", "--reload"]
        print(f"Backend command: {' '.join(backend_cmd)}")
        backend_process = subprocess.Popen(
            backend_cmd,
            cwd=api_dir,
            creationflags=subprocess.CREATE_NEW_CONSOLE if platform.system() == "Windows" else 0
        )
        print(f"Backend server process started (PID: {backend_process.pid})")
        
        # Wait for backend to start
        print("Waiting for backend server to initialize...")
        time.sleep(3) # Increased wait time
        
        # Start frontend server
        print(f"Starting frontend server in {frontend_dir}...")
        # Use shell=True on Windows for npm commands
        use_shell_frontend = platform.system() == "Windows"
        frontend_cmd = ["npm", "run", "dev"]
        print(f"Frontend command: {' '.join(frontend_cmd)} (shell={use_shell_frontend})")
        frontend_process = subprocess.Popen(
            frontend_cmd,
            cwd=frontend_dir,
            shell=use_shell_frontend, # Use shell=True on Windows
            creationflags=subprocess.CREATE_NEW_CONSOLE if platform.system() == "Windows" else 0
        )
        print(f"Frontend server process started (PID: {frontend_process.pid})")
        
        # Wait for frontend to start
        print("Waiting for frontend server to initialize...")
        time.sleep(7) # Increased wait time
        
        print("\nDevelopment servers running.")
        # Open the application in the default browser
        try:
            print("Opening application in browser...")
            webbrowser.open("http://localhost:5173")
        except Exception as browser_error:
            print(f"Warning: Could not open browser automatically: {browser_error}")
            print("Please navigate to http://localhost:5173 manually.")
        
        print("\nPress Ctrl+C in this window to stop both servers.")
        # Wait for backend process to finish (e.g., if it crashes)
        backend_exit_code = backend_process.wait()
        print(f"Backend server process exited with code {backend_exit_code}.")

    except FileNotFoundError as e:
        print(f"\nError: File Not Found during server startup.")
        print(f"This usually means an executable (like python, uvicorn, node, or npm) was not found in the system PATH.")
        print(f"Details: {str(e)}")
        # Terminate the other process if it started
        if backend_process and backend_process.poll() is None:
            backend_process.terminate()
        if frontend_process and frontend_process.poll() is None:
            frontend_process.terminate()
        sys.exit(1)
    except Exception as e:
        print(f"\nAn unexpected error occurred during server startup: {str(e)}")
        # Terminate the other process if it started
        if backend_process and backend_process.poll() is None:
            backend_process.terminate()
        if frontend_process and frontend_process.poll() is None:
            frontend_process.terminate()
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nCtrl+C detected. Shutting down servers...")
    finally:
        # Ensure processes are terminated on exit or interrupt
        if backend_process and backend_process.poll() is None:
            print("Terminating backend server...")
            backend_process.terminate()
            backend_process.wait()
        if frontend_process and frontend_process.poll() is None:
            print("Terminating frontend server...")
            frontend_process.terminate()
            frontend_process.wait()
        print("Servers stopped.")

def main():
    """Main entry point for the development setup script."""
    print("="*60)
    print("Setting up Intune Deployment Toolkit development environment...")
    print("="*60)
    print(f"Running script from: {Path.cwd()}")
    print(f"Operating System: {platform.system()} {platform.release()}")
    
    try:
        # Verify directory structure
        verify_directory_structure()
        
        # Check versions
        check_python_version()
        check_node_version()
        
        # Install dependencies
        install_frontend_dependencies()
        install_backend_dependencies()
        
        # Start development servers
        start_development_servers()
        
        print("\nSetup complete. Servers are running.")
        
    except KeyboardInterrupt:
        print("\nSetup interrupted by user.")
        sys.exit(1)
    except subprocess.CalledProcessError:
        print("\nA command failed to execute. Please check the error messages above.")
        sys.exit(1)
    except Exception as e:
        print(f"\nAn unexpected error occurred during setup: {str(e)}")
        import traceback
        traceback.print_exc() # Print detailed traceback for unexpected errors
        sys.exit(1)

if __name__ == "__main__":
    main() 