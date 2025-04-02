import asyncio
import subprocess
import threading
import time
import json
import os
from typing import Optional, Tuple, Dict, Any

# Configuration (Consider moving to a dedicated config file or env vars)
SESSION_TIMEOUT_MINUTES = 30 
POWERSHELL_EXECUTABLE = "powershell.exe" if os.name == 'nt' else "pwsh" # Handle cross-platform

class PowerShellSessionManager:
    """Manages a persistent PowerShell session for Intune interactions."""

    def __init__(self, timeout_minutes: int = SESSION_TIMEOUT_MINUTES):
        self.process: Optional[subprocess.Popen] = None
        self.tenant_id: Optional[str] = None
        self.last_active_time: float = 0
        self.session_lock = asyncio.Lock()
        self.timeout_minutes = timeout_minutes
        self._timeout_task: Optional[asyncio.Task] = None
        self._stop_event = threading.Event() # For stopping the timeout thread cleanly

        # Unique markers to detect end of command output
        self._stdout_marker = "--CmdEnd--\\n"
        self._stderr_marker = "--CmdErrEnd--\\n"
        self._marker_command = f"Write-Host '{self._stdout_marker}'; Write-Error '{self._stderr_marker}'"

    async def _start_timeout_monitor(self):
        """Starts the background task to monitor session inactivity."""
        if self._timeout_task and not self._timeout_task.done():
            self._timeout_task.cancel() # Cancel existing monitor if any

        async def monitor():
            while not self._stop_event.is_set():
                try:
                    await asyncio.sleep(60) # Check every minute
                    if self.is_active():
                        idle_time = time.time() - self.last_active_time
                        if idle_time > self.timeout_minutes * 60:
                            print(f"Session timed out after {self.timeout_minutes} minutes of inactivity.")
                            await self.terminate_session("Timeout")
                except asyncio.CancelledError:
                    print("Timeout monitor cancelled.")
                    break
                except Exception as e:
                    print(f"Error in timeout monitor: {e}")
                    # Decide if we should break or continue
                    await asyncio.sleep(5) # Wait before retrying after error

        self._stop_event.clear()
        self._timeout_task = asyncio.create_task(monitor())
        print("Session timeout monitor started.")


    async def _stop_timeout_monitor(self):
        """Stops the background timeout monitoring task."""
        self._stop_event.set()
        if self._timeout_task and not self._timeout_task.done():
            self._timeout_task.cancel()
            try:
                await self._timeout_task
            except asyncio.CancelledError:
                pass # Expected
        print("Session timeout monitor stopped.")

    def is_active(self) -> bool:
        """Checks if a PowerShell session is currently active."""
        return self.process is not None and self.process.poll() is None

    async def get_status(self) -> Dict[str, Any]:
        """Gets the current status of the session."""
        async with self.session_lock:
            if self.is_active():
                return {
                    "active": True,
                    "tenant_id": self.tenant_id,
                    "last_active": self.last_active_time
                }
            else:
                return {"active": False}

    async def execute_command(self, command: str, parse_json: bool = False) -> Dict[str, Any]:
        """
        Executes a command in the persistent PowerShell session.

        Args:
            command: The PowerShell command to execute.
            parse_json: Whether to attempt parsing the stdout as JSON.

        Returns:
            A dictionary containing 'success', 'output', and 'error'.
        """
        async with self.session_lock:
            if not self.is_active():
                return {"success": False, "output": None, "error": "Session is not active."}

            try:
                # Ensure process is still running
                if self.process.poll() is not None:
                    await self.terminate_session("Process died unexpectedly")
                    return {"success": False, "output": None, "error": "Session process terminated unexpectedly."}

                # Update activity time
                self.last_active_time = time.time()

                # Combine user command with markers for reliable output reading
                full_command = f"{command}; {self._marker_command}\\n"
                
                # Write command to stdin
                self.process.stdin.write(full_command.encode('utf-8'))
                self.process.stdin.flush()

                stdout_buffer = ""
                stderr_buffer = ""
                
                # Use asyncio to read stdout/stderr without blocking
                # Note: Direct reading from Popen streams in asyncio requires careful handling
                # or using asyncio subprocesses. For simplicity here, we might use
                                # threads or a simpler blocking read with timeout, but let's try a basic async approach.
                # A more robust implementation might use asyncio.StreamReader

                # --- Reading stdout ---
                while self._stdout_marker not in stdout_buffer:
                    if self.process.poll() is not None: # Check if process died during read
                         raise OSError("Process terminated during command execution")
                    # This part is tricky without full asyncio subprocesses.
                    # Let's use a non-blocking read approach if possible or fallback.
                    # For now, a simple readline might block, need refinement.
                    # Using loop.run_in_executor might be needed for truly non-blocking sync Popen
                    try:
                        # Attempt a non-blocking read (conceptual, platform dependent)
                        # Or use a timeout mechanism with select/poll if available via libraries
                        line = await asyncio.to_thread(self.process.stdout.readline)
                        if not line: break # End of stream? Process likely dead.
                        stdout_buffer += line.decode('utf-8', errors='replace')
                    except Exception as read_exc:
                         # Handle potential blocking or errors
                         print(f"Error reading stdout: {read_exc}")
                         stderr_buffer += f"Error reading stdout: {read_exc}\\n"
                         break # Exit loop on read error

                # --- Reading stderr ---
                while self._stderr_marker not in stderr_buffer:
                     if self.process.poll() is not None: # Check if process died during read
                          raise OSError("Process terminated during command execution")
                     try:
                        line = await asyncio.to_thread(self.process.stderr.readline)
                        if not line: break
                        stderr_buffer += line.decode('utf-8', errors='replace')
                     except Exception as read_exc:
                         print(f"Error reading stderr: {read_exc}")
                         stderr_buffer += f"Error reading stderr: {read_exc}\\n"
                         break
                
                # Clean up markers from output
                stdout_clean = stdout_buffer.replace(self._stdout_marker, "").strip()
                stderr_clean = stderr_buffer.replace(self._stderr_marker, "").strip()

                output_data = None
                success = True # Assume success unless stderr indicates otherwise (simplistic)
                
                if parse_json:
                    try:
                        output_data = json.loads(stdout_clean) if stdout_clean else None
                        # Check for explicit failure in JSON structure if applicable
                        if isinstance(output_data, dict) and output_data.get('Success') is False:
                             success = False
                             stderr_clean = output_data.get('Error', stderr_clean)
                    except json.JSONDecodeError:
                        # stderr_clean += "\\nWarning: Failed to parse stdout as JSON."
                        output_data = stdout_clean # Return raw string if JSON parse fails
                else:
                    output_data = stdout_clean

                # Crude check for errors - PowerShell often writes errors to stderr
                # even on overall "success" (return code 0). A more robust check
                # might involve examining $? or $LASTEXITCODE within the PS session.
                if stderr_clean:
                    # Decide if this stderr constitutes a failure
                    # For now, let's report it but not necessarily mark as failed unless severe
                     print(f"Command stderr: {stderr_clean}")
                     # if "Error:" in stderr_clean or "Exception:" in stderr_clean: success = False

                return {"success": success, "output": output_data, "error": stderr_clean}

            except (OSError, BrokenPipeError, Exception) as e:
                print(f"Error executing command: {e}")
                # Attempt to terminate the potentially broken session
                await self.terminate_session(f"Error during execution: {e}")
                return {"success": False, "output": None, "error": str(e)}


    async def start_session(self, tenant_id: Optional[str] = None, client_id: Optional[str] = None) -> Dict[str, Any]:
        """Starts a new PowerShell session and connects to Intune."""
        async with self.session_lock:
            # Terminate existing session first
            if self.is_active():
                await self.terminate_session("Starting new session")

            print("Starting new PowerShell session...")
            try:
                # -NoExit keeps the process alive after the initial command
                # -Command - allows running initial setup
                # Using -EncodedCommand might be more robust for complex startup scripts
                self.process = subprocess.Popen(
                    [POWERSHELL_EXECUTABLE, "-NoExit", "-Command", "-"], # Read commands from stdin
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    # Set buffer size to avoid blocking on large output? bufsize=1?
                    # Use shell=True? Generally discouraged, but sometimes needed on Windows? Test.
                )
                
                # Start the timeout monitor
                await self._start_timeout_monitor()

                self.last_active_time = time.time()
                self.tenant_id = tenant_id # Store intended tenant ID

                # Construct connection command
                # TODO: Adjust path and parameters based on actual Connect-to-Intune.ps1 script
                script_path = os.path.abspath("./scripts/Connect-to-Intune.ps1")
                connect_command = f"& '{script_path}'"
                if tenant_id:
                    connect_command += f" -TenantID '{tenant_id}'"
                if client_id:
                    connect_command += f" -ClientID '{client_id}'"
                # Add -AsJson parameter if the script supports it for structured output
                connect_command += " -AsJson" # Assuming script is modified or supports this

                print(f"Executing connection command: {connect_command}")
                result = await self.execute_command(connect_command, parse_json=True)

                if result["success"]:
                    # Update tenant_id from actual connection result if available
                    if isinstance(result["output"], dict) and result["output"].get("TenantID"):
                        self.tenant_id = result["output"]["TenantID"]
                    print(f"Session started successfully for tenant: {self.tenant_id}")
                    return {"success": True, "message": "Connected successfully.", "tenant_id": self.tenant_id}
                else:
                    print("Failed to start session or connect.")
                    await self.terminate_session("Connection script failed")
                    return {"success": False, "error": result.get("error", "Connection script failed."), "output": result.get("output")}

            except Exception as e:
                print(f"Failed to start PowerShell process: {e}")
                if self.process:
                     try:
                          self.process.kill()
                     except Exception: pass # Ignore errors during cleanup
                self.process = None
                return {"success": False, "error": f"Failed to start PowerShell process: {e}"}

    async def terminate_session(self, reason: str = "User requested"):
        """Terminates the active PowerShell session."""
        
        async with self.session_lock: # Ensure only one thread terminates
            if not self.is_active():
                print("Terminate requested, but no active session found.")
                return

            print(f"Terminating PowerShell session. Reason: {reason}")
            
            # Stop the timeout monitor first
            await self._stop_timeout_monitor()

            try:
                # Optionally run a disconnect script first
                disconnect_script_path = os.path.abspath("./scripts/Disconnect-Intune.ps1")
                if os.path.exists(disconnect_script_path):
                    print("Running disconnect script...")
                    disconnect_command = f"& '{disconnect_script_path}'; exit" # Add exit after disconnect
                    # Use a short timeout for the disconnect command
                    try:
                         # Write command to stdin
                         self.process.stdin.write(disconnect_command.encode('utf-8'))
                         self.process.stdin.flush()
                         # Wait a bit for the command to potentially execute
                         await asyncio.sleep(2) 
                    except (OSError, BrokenPipeError) as disconnect_err:
                         print(f"Error sending disconnect command (session likely already ending): {disconnect_err}")
                else:
                    # If no disconnect script, just send exit command
                     try:
                          self.process.stdin.write(b"exit\\n")
                          self.process.stdin.flush()
                     except (OSError, BrokenPipeError) as exit_err:
                         print(f"Error sending exit command (session likely already ending): {exit_err}")
                
                # Wait briefly for graceful exit
                try:
                    await asyncio.wait_for(asyncio.to_thread(self.process.wait), timeout=5.0)
                    print("Session exited gracefully.")
                except asyncio.TimeoutError:
                    print("Session did not exit gracefully, killing process.")
                    self.process.kill()
                except Exception as wait_exc: # Catch other potential errors during wait
                    print(f"Error waiting for process exit: {wait_exc}. Killing process.")
                    self.process.kill()

            except Exception as e:
                print(f"Error during session termination: {e}. Attempting force kill.")
                if self.process and self.process.poll() is None:
                    self.process.kill() # Force kill if errors occurred

            finally:
                # Clean up resources
                if self.process:
                    try: self.process.stdin.close()
                    except Exception: pass
                    try: self.process.stdout.close()
                    except Exception: pass
                    try: self.process.stderr.close()
                    except Exception: pass
                
                self.process = None
                self.tenant_id = None
                self.last_active_time = 0
                print("Session terminated and resources cleaned up.")

# Global instance (for single-user context)
# Consider dependency injection for more complex scenarios
powershell_session_manager = PowerShellSessionManager()

# Function to ensure cleanup on application exit (to be called from FastAPI shutdown)
async def cleanup_powershell_session():
    """Cleans up the global PowerShell session."""
    print("Application shutdown triggered: Cleaning up PowerShell session...")
    await powershell_session_manager.terminate_session("Application shutdown") 