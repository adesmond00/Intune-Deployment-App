"""
Helper for generating Intune detection scripts using OpenAI.

This module provides functionality to generate PowerShell detection scripts
for Intune Win32 app deployments based on app names, using OpenAI's API.
"""

import json
import logging
import os
from typing import Dict, Optional, Union, List

import requests

# OpenAI API key - replace with your key
OPENAI_API_KEY = "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"

logger = logging.getLogger(__name__)
if not logger.handlers:
    # default to INFO level if the parent application hasn't configured logging
    logging.basicConfig(level=logging.INFO)

# Base URL for OpenAI API
OPENAI_API_BASE = "https://api.openai.com/v1"


def generate_detection_script(
    app_name: str, 
    model: str = "gpt-3.5-turbo",  # Using a more widely available model
    use_predicted_outputs: bool = False  # Temporarily disable predicted outputs for testing
) -> str:
    """
    Generate a PowerShell detection script for an Intune Win32 app deployment.
    
    The script will detect if the specified app is installed by checking common
    installation indicators (registry entries or executable files). The detection
    script follows Intune requirements where a successful detection:
    1. Returns an exit code of 0
    2. Writes a string value to STDOUT
    
    Parameters
    ----------
    app_name : str
        The name of the application to detect
    model : str, optional
        The OpenAI model to use, defaults to "gpt-3.5-turbo"
    use_predicted_outputs : bool, optional
        Whether to use OpenAI's predicted outputs feature for faster response times, 
        defaults to False
        
    Returns
    -------
    str
        The generated PowerShell detection script
    
    Raises
    ------
    Exception
        If the API call fails or the response cannot be processed
    """
    logger.info(f"Generating detection script for app: {app_name}")
    
    # Template with common detection script patterns to enable predicted outputs
    script_template = """<#
.SYNOPSIS
    Intune detection script for {app_name}
.DESCRIPTION
    This script checks if {app_name} is installed on the system
    and outputs a string if found while returning exit code 0.
#>

# Initialize variables
$appFound = $false
$appName = "{app_name}"
$registryPaths = @(
    "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
    "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*"
)

try {{
    # DETECTION LOGIC WILL BE INSERTED HERE
    
    # If app is found, output a message and exit with code 0
    if ($appFound) {{
        Write-Output "Found $appName installation."
        exit 0
    }} else {{
        Write-Output "$appName not found."
        exit 1
    }}
}} catch {{
    Write-Error "Error in detection script: $_"
    exit 1
}}
"""
    
    # System message to instruct the model on its task
    system_message = """
You are an expert PowerShell script writer specializing in Microsoft Intune detection scripts.

Your task is to create a detection script for the specified application that follows these requirements:

1. The script MUST return an exit code of 0 ONLY when the app is found
2. The script MUST write a string to STDOUT when the app is found
3. The script should look for the most reliable indicators of installation, such as:
   - Registry entries (HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall, HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall)
   - Program Files directories
   - AppData locations
   - Standard installation paths
4. The script should be robust with appropriate error handling
5. Return ONLY the PowerShell script with no additional text, explanations, or markdown formatting

Remember: For Intune detection to be successful, the script must both return an exit code of 0 AND write a string to STDOUT.
"""
    
    # Create proper completion using OpenAI's API
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {OPENAI_API_KEY}"
    }
    
    # Simplified payload for reliability
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_message},
            {"role": "user", "content": f"Create a PowerShell detection script for {app_name} that checks if it's installed. The script should return exit code 0 and write to STDOUT only when the app is found."}
        ]
    }
    
    try:
        logger.debug(f"Sending request to OpenAI API for app: {app_name}")
        response = requests.post(
            f"{OPENAI_API_BASE}/chat/completions", 
            headers=headers, 
            json=payload
        )
        response.raise_for_status()
        response_data = response.json()
        
        # Extract the content
        if "choices" in response_data and response_data["choices"]:
            content = response_data["choices"][0]["message"]["content"]
            
            # Extract code block if present
            if "```powershell" in content or "```ps1" in content:
                # Extract code from markdown code blocks
                import re
                code_blocks = re.findall(r'```(?:powershell|ps1)(.*?)```', content, re.DOTALL)
                if code_blocks:
                    script = code_blocks[0].strip()
                else:
                    script = content  # Fallback
            else:
                script = content
                
            logger.info(f"Successfully generated detection script for {app_name}")
            return script
        else:
            raise ValueError("Unexpected response format from OpenAI")
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Error making request to OpenAI API: {str(e)}")
        raise Exception(f"Failed to connect to OpenAI API: {str(e)}") from e
    except (KeyError, ValueError) as e:
        logger.error(f"Error processing OpenAI response: {str(e)}")
        raise Exception(f"Failed to process OpenAI response: {str(e)}") from e


def generate_detection_script_with_function_calling(
    app_name: str, 
    model: str = "gpt-3.5-turbo"  # Using a more widely available model
) -> str:
    """
    Alternative implementation using OpenAI's function calling feature.
    
    This method uses the function calling API to ensure properly structured output.
    
    Parameters
    ----------
    app_name : str
        The name of the application to detect
    model : str, optional
        The OpenAI model to use, defaults to "gpt-3.5-turbo"
        
    Returns
    -------
    str
        The generated PowerShell detection script
    """
    logger.info(f"Generating detection script using function calling for app: {app_name}")
    
    # System message to instruct the model on its task
    system_message = """
You are an expert PowerShell script writer specializing in Microsoft Intune detection scripts.

Your task is to create a detection script for the specified application that follows these requirements:

1. The script MUST return an exit code of 0 ONLY when the app is found
2. The script MUST write a string to STDOUT when the app is found
3. The script should look for the most reliable indicators of installation, such as:
   - Registry entries (HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall, HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall)
   - Program Files directories
   - AppData locations
   - Standard installation paths
4. The script should be robust with appropriate error handling

Remember: For Intune detection to be successful, the script must both return an exit code of 0 AND write a string to STDOUT.
"""
    
    # Define function schema with strict mode enabled
    function_definition = {
        "name": "generate_detection_script",
        "description": "Generate a PowerShell detection script for Intune",
        "parameters": {
            "type": "object",
            "properties": {
                "script": {
                    "type": "string", 
                    "description": "The complete PowerShell detection script"
                }
            },
            "required": ["script"]
        }
    }
    
    # Create a completion using OpenAI's API with defined structure
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {OPENAI_API_KEY}"
    }
    
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_message},
            {"role": "user", "content": f"Create a detection script for {app_name}"}
        ],
        "functions": [function_definition],  # Using the older "functions" parameter for compatibility
        "function_call": {"name": "generate_detection_script"}  # Using the older function_call parameter
    }
    
    try:
        logger.debug(f"Sending request to OpenAI API for app: {app_name}")
        response = requests.post(
            f"{OPENAI_API_BASE}/chat/completions", 
            headers=headers, 
            json=payload
        )
        response.raise_for_status()
        response_data = response.json()
        
        # Extract the function call arguments which contain our script
        function_call = response_data["choices"][0]["message"].get("function_call")
        if function_call and function_call["name"] == "generate_detection_script":
            arguments = json.loads(function_call["arguments"])
            script = arguments.get("script", "")
            
            if not script:
                raise ValueError("Received empty script from OpenAI")
            
            logger.info(f"Successfully generated detection script for {app_name}")
            return script
        else:
            # Fallback to regular content if function call not present
            content = response_data["choices"][0]["message"].get("content", "")
            if content:
                logger.info(f"Falling back to content output for {app_name}")
                return content
            else:
                raise ValueError("Unexpected response format from OpenAI")
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Error making request to OpenAI API: {str(e)}")
        raise Exception(f"Failed to connect to OpenAI API: {str(e)}") from e
    except (KeyError, ValueError, json.JSONDecodeError) as e:
        logger.error(f"Error processing OpenAI response: {str(e)}")
        raise Exception(f"Failed to process OpenAI response: {str(e)}") from e