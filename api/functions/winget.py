import subprocess
from typing import Dict, Any

def search_package(search_term: str) -> Dict[str, Any]:
    """
    Search for packages using winget.
    
    Args:
        search_term (str): The term to search for in winget
        
    Returns:
        Dict[str, Any]: Dictionary containing the search results and status
    """
    try:
        # Construct the PowerShell command
        powershell_command = f"winget search {search_term} --accept-source-agreements"
        
        # Execute the command using PowerShell
        result = subprocess.run(
            ["powershell", "-Command", powershell_command],
            capture_output=True,
            text=True,
            check=True
        )
        
        # Return the output
        return {
            "status": "success",
            "output": result.stdout,
            "error": result.stderr
        }
    except subprocess.CalledProcessError as e:
        return {
            "status": "error",
            "output": e.stdout,
            "error": e.stderr
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }
