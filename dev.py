#!/usr/bin/env python3
"""
Development setup script for Intune Deployment Toolkit.

This script handles:
1. Installing frontend dependencies (npm)
2. Installing backend dependencies (pip)
3. Starting both frontend and backend servers in development mode.
   - Backend server (uvicorn) is started on a dynamically chosen available port.
   - The chosen API URL is passed to the frontend server via an environment variable.
"""

import os
import sys
import subprocess
import time
import webbrowser
import signal
import platform
import re # Import regex module
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
    """
    Starts the backend (uvicorn) and frontend (npm) development servers.

    The backend server is started first on host 127.0.0.1 and port 0, which allows
    the OS to assign an available ephemeral port. The script captures the standard
    output of the uvicorn process to find the actual URL (including the assigned port)
    where the API is running. 

    This captured API URL is then passed as an environment variable (VITE_API_BASE_URL)
    to the frontend development server process (npm run dev).

    Raises:
        RuntimeError: If the backend server fails to start or the API URL cannot be
                      determined from its output within a specified timeout.
        FileNotFoundError: If required executables (python, uvicorn, node, npm) are missing.
        Exception: For other unexpected errors during startup.
    """
    print("\nStarting development servers...")
    
    frontend_dir = Path("Front-end").resolve()
    api_dir = Path("api").resolve()
    
    print(f"Backend API directory: {api_dir}")
    print(f"Frontend directory: {frontend_dir}")
    
    if not api_dir.exists():
        print(f"Error: API directory not found at {api_dir}")
        sys.exit(1)
    if not frontend_dir.exists():
        print(f"Error: Frontend directory not found at {frontend_dir}")
        sys.exit(1)
    
    backend_process = None
    frontend_process = None
    api_base_url = None
    url_capture_timeout = 15 # Seconds to wait for API URL

    try:
        # Start backend server on dynamic port
        print(f"Starting backend server in {api_dir} on dynamic port...")
        # Command uses --port 0 to request dynamic port assignment
        # --reload is kept for development convenience
        backend_cmd = [sys.executable, "-m", "uvicorn", "api:app", "--host", "127.0.0.1", "--port", "0", "--reload"]
        print(f"Backend command: {' '.join(backend_cmd)}")
        
        # Start the process, capturing stdout/stderr
        backend_process = subprocess.Popen(
            backend_cmd,
            cwd=api_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, # Redirect stderr to stdout
            text=True,
            encoding='utf-8',
            bufsize=1, # Line buffered
            creationflags=subprocess.CREATE_NEW_CONSOLE if platform.system() == "Windows" else 0
        )
        print(f"Backend server process starting (PID: {backend_process.pid}). Waiting for URL...")

        # Capture the API URL from backend stdout
        start_time = time.time()
        url_pattern = re.compile(r"Uvicorn running on (http://127\.0\.0\.1:\d+)") # Regex to find the URL
        
        while time.time() - start_time < url_capture_timeout:
            if backend_process.stdout:
                line = backend_process.stdout.readline()
                if line:
                    print(f"[BACKEND]: {line.strip()}") # Print backend output
                    match = url_pattern.search(line)
                    if match:
                        api_base_url = match.group(1)
                        print(f"\n*** Captured API Base URL: {api_base_url} ***\n")
                        break # URL found, exit loop
                else:
                    # No output, wait briefly
                    time.sleep(0.1)
            else:
                # stdout is not available (should not happen with PIPE)
                time.sleep(0.1)

            # Check if backend process terminated unexpectedly
            if backend_process.poll() is not None:
                raise RuntimeError(f"Backend server process terminated unexpectedly with code {backend_process.poll()} before announcing URL.")

        # Check if URL was found
        if not api_base_url:
            raise RuntimeError(f"Could not determine backend API URL after {url_capture_timeout} seconds.")

        # Prepare environment for frontend server
        frontend_env = os.environ.copy()
        frontend_env['VITE_API_BASE_URL'] = api_base_url
        print(f"Passing VITE_API_BASE_URL={api_base_url} to frontend.")

        # Start frontend server with the API URL environment variable
        print(f"Starting frontend server in {frontend_dir}...")
        use_shell_frontend = platform.system() == "Windows"
        frontend_cmd = ["npm", "run", "dev"]
        print(f"Frontend command: {' '.join(frontend_cmd)} (shell={use_shell_frontend})")
        frontend_process = subprocess.Popen(
            frontend_cmd,
            cwd=frontend_dir,
            shell=use_shell_frontend,
            env=frontend_env, # Pass the modified environment
            creationflags=subprocess.CREATE_NEW_CONSOLE if platform.system() == "Windows" else 0
        )
        print(f"Frontend server process started (PID: {frontend_process.pid})")
        
        # Wait for frontend to likely start (can't easily detect readiness)
        print("Waiting for frontend server to initialize (approx 7 seconds)...")
        time.sleep(7)
        
        print("\nDevelopment servers running.")
        # Attempt to open the default frontend URL in browser
        # Note: The actual Vite port (default 5173) isn't captured dynamically here,
        # assumes default behavior. Could be enhanced if needed.
        frontend_url = "http://localhost:5173"
        try:
            print(f"Opening application frontend at {frontend_url} in browser...")
            webbrowser.open(frontend_url)
        except Exception as browser_error:
            print(f"Warning: Could not open browser automatically: {browser_error}")
            print(f"Please navigate to {frontend_url} manually.")
        
        print("\nPress Ctrl+C in this window to stop both servers.")
        # Wait indefinitely for user interrupt or process exit
        signal.signal(signal.SIGINT, signal.default_int_handler) # Ensure Ctrl+C works
        signal.signal(signal.SIGTERM, lambda signum, frame: sys.exit(0)) # Handle termination
        try:
             # Wait for backend to finish (e.g. user stops it, or it crashes)
             backend_exit_code = backend_process.wait()
             print(f"Backend server process exited with code {backend_exit_code}.")
        except KeyboardInterrupt:
             print("\nCtrl+C detected during wait. Proceeding to shutdown...")

    except FileNotFoundError as e:
        print(f"\nError: File Not Found during server startup.")
        print(f"This usually means an executable (like python, uvicorn, node, or npm) was not found in the system PATH.")
        print(f"Details: {str(e)}")
        sys.exit(1)
    except (RuntimeError, Exception) as e:
        print(f"\nAn error occurred during server startup: {str(e)}")
        sys.exit(1)
    finally:
        # Ensure processes are terminated on exit or interrupt
        print("\nShutting down servers...") # Moved message here
        if frontend_process and frontend_process.poll() is None:
            print("Terminating frontend server...")
            frontend_process.terminate()
            try:
                frontend_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                print("Frontend process did not terminate gracefully, killing...")
                frontend_process.kill()
        if backend_process and backend_process.poll() is None:
            print("Terminating backend server...")
            backend_process.terminate()
            try:
                backend_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                print("Backend process did not terminate gracefully, killing...")
                backend_process.kill()
        print("Servers stopped.")

def main():
    """Main entry point for the development setup script."""
    print("="*60)
    print("Starting Intune Deployment Toolkit Development Environment")
    print("="*60)
    
    try:
        verify_directory_structure()
        check_python_version()
        check_node_version()
        install_backend_dependencies()
        install_frontend_dependencies()
        start_development_servers()
    except Exception as e:
        print(f"\nSetup failed: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nSetup interrupted by user.")
        sys.exit(1)

if __name__ == "__main__":
    main() 