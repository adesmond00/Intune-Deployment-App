"""
PowerShell Session Management (Deprecated)

This module previously contained the PowerShellSessionManager class for managing
a persistent PowerShell session for interactive Intune login.

This functionality has been deprecated and replaced by an OAuth 2.0
Authorization Code Grant flow handled in api.py, using temporary
PowerShell processes authenticated with access tokens for script execution.

This file is kept for historical reference but is no longer actively used
by the core authentication or script execution logic.
"""

# (Content removed as persistent session logic is deprecated)

pass # Keep file valid Python syntax
