import subprocess
from typing import Dict, Any, List
import re

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
            check=True,
            encoding='utf-8',
            errors='ignore'
        )
        
        # Decode stdout and stderr explicitly using UTF-8
        stdout_decoded = result.stdout
        stderr_decoded = result.stderr

        # Return the decoded output
        return {
            "status": "success",
            "output": stdout_decoded,
            "error": stderr_decoded
        }
    except subprocess.CalledProcessError as e:
        # Decode stdout and stderr from the exception as well
        stdout_decoded = e.stdout.decode('utf-8', errors='ignore') if isinstance(e.stdout, bytes) else e.stdout
        stderr_decoded = e.stderr.decode('utf-8', errors='ignore') if isinstance(e.stderr, bytes) else e.stderr
        return {
            "status": "error",
            "output": stdout_decoded,
            "error": stderr_decoded
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

def parse_winget_output(raw_output: str) -> List[Dict[str, str]]:
    """
    Parses the raw string output from 'winget search' into a list of dictionaries.

    Args:
        raw_output (str): The raw string output from the winget search command.

    Returns:
        List[Dict[str, str]]: A list of applications, each represented as a dictionary
                              with keys "Name", "Id", "Version", and "Source".
                              Returns an empty list if parsing fails or output is empty.
    """
    apps = []
    if not raw_output:
        return []

    lines = raw_output.strip().split('\n')

    header_index = -1
    # Restore original stricter header pattern
    header_pattern = re.compile(r"^\\s*Name\\s+Id\\s+Version\\s+(?:Match\\s+)?Source\\s*$", re.IGNORECASE)
    # print("DEBUG: Using simplified header pattern.") # Remove debug print
    # Removed separator_pattern as it's unreliable

    # Find header line, skipping potential initial junk lines
    for i, line in enumerate(lines):
        line_strip = line.strip()
        # Skip blank lines or placeholder dashes
        if not line_strip or line_strip == '-':
            # print(f"DEBUG: Skipping line {i}: '{line_strip}'") # Remove debug print
            continue

        # --- DEBUGGING START ---
        # print(f"DEBUG: Testing line {i}: '{line_strip}'") # Remove debug print
        # --- DEBUGGING END ---
        
        if header_pattern.search(line_strip):
            header_index = i
            # print(f"DEBUG: Found header at index {header_index} with pattern: '{line_strip}'") # Remove debug print
            break # Found header

    if header_index == -1:
        print(f"Could not find expected header line ('Name Id Version...') in winget output.")
        # Log first few lines for context if failed
        print("First few lines of output:")
        for k in range(min(10, len(lines))):
             print(f"  {k}: {lines[k]}")
        return []

    # Find column start indices using regex word boundaries on the header line
    header_line = lines[header_index]
    try:
        # Find the start index of each column name using word boundaries (\b)
        name_match = re.search(r'\bName\b', header_line, re.IGNORECASE)
        id_match = re.search(r'\bId\b', header_line, re.IGNORECASE)
        version_match = re.search(r'\bVersion\b', header_line, re.IGNORECASE)
        match_match = re.search(r'\bMatch\b', header_line, re.IGNORECASE) # Optional
        source_match = re.search(r'\bSource\b', header_line, re.IGNORECASE)

        # Ensure required columns were found
        if not (name_match and id_match and version_match and source_match):
            raise ValueError("Required column names (Name, Id, Version, Source) not found in header")

        name_start = name_match.start()
        id_start = id_match.start()
        version_start = version_match.start()
        match_start = match_match.start() if match_match else -1
        source_start = source_match.start()
        
        # print(f"DEBUG: Column Starts - Name:{name_start}, Id:{id_start}, Version:{version_start}, Match:{match_start}, Source:{source_start}") # Remove debug print

    except (ValueError, AttributeError) as e: # Catch AttributeError if .start() is called on None
        print(f"Error parsing header line to find column start indices: '{header_line}'. Error: {e}")
        return []

    # Process data lines starting 2 lines after the header
    start_data_line_index = header_index + 2
    if start_data_line_index >= len(lines):
        print("No data lines found after header.") # Updated message
        return []
        
    for line_num, line in enumerate(lines[start_data_line_index:], start=start_data_line_index):
        line_stripped = line.strip()
        if not line_stripped:
            continue

        # Use rstrip() to preserve leading space for slicing
        line_for_slicing = line.rstrip()
        line_len = len(line_for_slicing)

        # Slice data based on the start indices found in the header
        # End slice index is the start of the next column
        name = line_for_slicing[name_start:id_start].strip() if line_len > name_start else ""
        id_part = line_for_slicing[id_start:version_start].strip() if line_len > id_start else ""
        
        # Determine end point for version slice (depends if Match exists)
        version_end = match_start if match_start != -1 else source_start
        version = line_for_slicing[version_start:version_end].strip() if line_len > version_start else ""
        
        # Determine end point for Match slice (if Match exists) or Source slice
        if match_start != -1:
             # Slice Match from match_start to source_start
             # match_content = line_for_slicing[match_start:source_start].strip() if line_len > match_start else "" 
             # We don't actually need the Match content for the output JSON
             pass # Just use its start index to correctly end Version and start Source

        # Source is from source_start to the end of the line
        source = line_for_slicing[source_start:].strip() if line_len > source_start else ""

        # Basic validation: require Name and Id
        if not name or not id_part:
           # print(f"Skipping line {line_num} due to missing Name/ID: '{line_stripped}'")
           continue

        apps.append({
            "Name": name,
            "Id": id_part,
            "Version": version,
            "Source": source
        })

    # print("DEBUG: Returning successfully parsed apps.") # Remove debug print
    return apps
