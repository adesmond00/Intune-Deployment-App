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

    # Skip processing if output is empty
    if not raw_output:
        return []

    lines = raw_output.strip().split('\n')

    # Find the header and separator lines to determine column positions
    header_index = -1
    separator_index = -1
    # Make header matching more robust (case-insensitive, flexible spacing)
    header_pattern = re.compile(r"Name\s+Id\s+Version\s+(Match\s+)?Source", re.IGNORECASE)
    separator_pattern = re.compile(r"^-+\s+-+\s+-+\s+(-+\s+)?-+") # Handle optional Match column separator

    for i, line in enumerate(lines):
        if header_pattern.search(line):
            header_index = i
            # Check if the next line looks like the separator
            if i + 1 < len(lines) and separator_pattern.search(lines[i + 1]):
                separator_index = i + 1
                break # Found header and separator

    # If header or separator wasn't found, we can't reliably parse
    if header_index == -1 or separator_index == -1:
        # Consider logging this unexpected format
        print(f"Could not find expected header/separator in winget output.")
        return []

    # Estimate column boundaries from the separator line
    separator_line = lines[separator_index]
    # Find the start of each column's data based on gaps in the separator
    space_indices = [match.start() for match in re.finditer(r"\s+", separator_line)]

    # Determine column indices based on typical winget output structure
    # We need at least Name, Id, Version, Source
    if len(space_indices) < 3:
         # Cannot determine columns reliably from separator
         print(f"Could not determine sufficient column separators from line: {separator_line}")
         return []

    # Column start/end indices (approximate)
    try:
        name_end = space_indices[0]
        id_end = space_indices[1]
        version_end = space_indices[2]
        # Source starts after the version column's separator gap
        source_start = space_indices[2] + 1 # Start after the space defining version end
        # Check if there's a 'Match' column separator
        has_match_column = len(space_indices) > 3
        if has_match_column:
             source_start = space_indices[3] + 1 # Source starts after Match column gap
    except IndexError:
        # Not enough spaces found in separator
        print(f"Separator line parsing error: {separator_line}")
        return []

    # Process data lines starting after the separator
    for line in lines[separator_index + 1:]:
        line = line.rstrip() # Keep leading whitespace for slicing, remove trailing
        if not line.strip(): # Skip empty lines
            continue

        # Extract based on estimated column widths derived from the separator
        name = line[:name_end].strip()
        id_part = line[name_end:id_end].strip()
        version = line[id_end:version_end].strip()
        # Source is everything after the determined source start position
        source = line[source_start:].strip()

        # Basic validation: Ensure essential parts were extracted
        if not name or not id_part:
           # Winget might return lines with only partial info sometimes
           # print(f"Skipping line due to missing Name/ID: {line}")
           continue

        apps.append({
            "Name": name,
            "Id": id_part,
            "Version": version, # Keep version even if empty, winget might omit it
            "Source": source
        })

    return apps
