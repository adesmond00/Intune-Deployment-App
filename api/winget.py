"""
Winget Module

This module provides functionality for interacting with the Windows Package Manager (winget).
It handles searching for applications and parsing the results in a structured format.

Author: [Your Name]
Version: 1.0.0
"""

import subprocess
from typing import List, Dict, Optional
from pydantic import BaseModel

# Removed unused WingetSearch model

class WingetResult(BaseModel):
    """
    Represents a single winget search result.
    
    Attributes:
        name (str): Name of the application
        id (str): Unique identifier for the application
        version (str): Current version of the application
        source (str): Source of the application (e.g., "winget")
    """
    name: str
    id: str
    version: str
    source: str = "Unknown"

def search_applications(search_term: str) -> Dict:
    """
    Search for applications using winget.
    
    This function executes a winget search command and returns the results
    in a structured format. It handles various edge cases and provides
    proper error handling.
    
    Args:
        search_term (str): The term to search for in the winget repository
        
    Returns:
        dict: A dictionary containing:
            - status: Success/failure status
            - results: List of found applications with their details
            - message: Optional message (e.g., "No results found")
            
    Raises:
        Exception: If the winget command fails or encounters an error
    """
    try:
        # Construct winget command with the search term
        winget_command = ["winget", "search", search_term]
        
        # Execute the command with proper encoding to handle special characters
        process = subprocess.Popen(
            winget_command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding='utf-8',
            errors='replace'
        )
        
        # Get the command output and any errors
        stdout, stderr = process.communicate()
        
        # Check if the command executed successfully
        if process.returncode == 0:
            # Split the output into lines and parse the results
            lines = stdout.strip().split('\n')
            if len(lines) < 2:  # If no results or only header
                return {
                    "status": "success",
                    "results": [],
                    "message": "No results found"
                }
            
            # Skip the header line and parse results
            results: List[WingetResult] = []
            for line in lines[1:]:  # Skip the header line
                # Split by multiple spaces and filter out empty strings
                parts = [part for part in line.split('  ') if part.strip()]
                if len(parts) >= 3:  # Ensure we have at least name, id, and version
                    results.append(WingetResult(
                        name=parts[0].strip(),
                        id=parts[1].strip(),
                        version=parts[2].strip(),
                        source=parts[3].strip() if len(parts) > 3 else "Unknown"
                    ))
            
            return {
                "status": "success",
                "results": [result.dict() for result in results]
            }
        else:
            raise Exception(f"Winget search failed: {stderr}")
            
    except Exception as e:
        raise Exception(f"Error performing winget search: {str(e)}")
