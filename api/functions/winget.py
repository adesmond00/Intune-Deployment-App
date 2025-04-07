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
    separator_index = -1
    # More robust regex for header and separator, anchored and allowing whitespace variations
    # Ensures 'Match' is treated as optional in the header pattern
    header_pattern = re.compile(r"^\\s*Name\\s+Id\\s+Version\\s+(?:Match\\s+)?Source\\s*$", re.IGNORECASE)
    # Ensures the separator pattern matches the structure including the optional 'Match' column dashes
    separator_pattern = re.compile(r"^\\s*-+\\s+-+\\s+-+\\s+(?:-+\\s+)?-+\\s*$")

    # Find header and separator, skipping potential initial junk lines
    for i, line in enumerate(lines):
        # Skip obviously non-header lines early (blank, placeholder dashes etc.)
        line_strip = line.strip()
        if not line_strip or line_strip == '-':
            continue

        if header_pattern.search(line_strip):
            # Found potential header, now look for separator on subsequent non-blank lines
            for j in range(i + 1, len(lines)):
                next_line = lines[j]
                next_line_strip = next_line.strip()
                if not next_line_strip: # Skip blank lines between header and separator
                    continue
                if separator_pattern.search(next_line_strip):
                    header_index = i
                    separator_index = j
                    # print(f"DEBUG: Found header at {header_index}, separator at {separator_index}") # DEBUG
                    break # Found both header and separator
                else:
                    # Found header, but the next non-blank line wasn't the expected separator
                    # print(f"DEBUG: Found header at {i}, but line {j} ('{next_line_strip}') is not separator.") # DEBUG
                    break # Stop looking for separator for this potential header
        if header_index != -1: # Stop searching lines once we've found the pair
             break

    if header_index == -1 or separator_index == -1:
        print(f"Could not find expected header/separator sequence in winget output.")
        # Log first few lines for context if failed
        print("First few lines of output:")
        for k in range(min(10, len(lines))):
             print(f"  {k}: {lines[k]}")
        return []

    separator_line = lines[separator_index]
    # Use the separator line structure to find column boundaries
    space_indices = [match.start() for match in re.finditer(r"\\s{2,}", separator_line)] # Find gaps of 2+ spaces

    # --- DEBUGGING START ---
    print(f"DEBUG: Separator line is: '{separator_line}'")
    print(f"DEBUG: Found space indices in separator: {space_indices}")
    # --- DEBUGGING END ---

    # We need at least 3 gaps for Name, Id, Version, Source (4 columns)
    # If 'Match' is present, we expect 4 gaps.
    if len(space_indices) < 3:
         print(f"Could not determine sufficient column separators from separator line: '{separator_line}' (Found {len(space_indices)} gaps)")
         return []

    # Determine column boundaries from separator gaps
    try:
        name_end = space_indices[0]
        id_end = space_indices[1]
        version_end = space_indices[2]
        # Check if 'Match' column seems present based on a 4th gap in the separator
        has_match_column = len(space_indices) > 3
        source_start = space_indices[3] + 1 if has_match_column else version_end + 1 # Start after the gap ending the previous column
        # print(f"DEBUG: Columns - NameEnd:{name_end}, IdEnd:{id_end}, VerEnd:{version_end}, SrcStart:{source_start}, HasMatch:{has_match_column}") # DEBUG
    except IndexError:
        # This shouldn't happen if len(space_indices) >= 3, but guard anyway
        print(f"Separator line parsing error (IndexError): {separator_line}")
        return []

    # Process data lines starting after the separator
    for line_num, line in enumerate(lines[separator_index + 1:], start=separator_index + 1):
        line_stripped = line.strip()
        if not line_stripped:
            continue

        # Use rstrip() on original line to preserve leading space for slicing, aids column alignment
        line_for_slicing = line.rstrip()

        # Extract based on separator indices
        # Ensure slicing doesn't go out of bounds if line is unexpectedly short
        name = line_for_slicing[:name_end].strip()
        id_part = line_for_slicing[name_end:id_end].strip() if len(line_for_slicing) > name_end else ""
        version = line_for_slicing[id_end:version_end].strip() if len(line_for_slicing) > id_end else ""
        source = line_for_slicing[source_start:].strip() if len(line_for_slicing) > source_start else ""

        # --- DEBUGGING START ---
        print(f"DEBUG line {line_num}: Extracted Name='{name}', ID='{id_part}'")
        # --- DEBUGGING END ---

        # Basic validation: require Name and Id at minimum
        if not name or not id_part:
           print(f"Skipping line {line_num} due to missing Name/ID: '{line_stripped}'") # Temporarily uncommented
           continue

        apps.append({
            "Name": name,
            "Id": id_part,
            "Version": version, # Keep version even if empty
            "Source": source
        })

    return apps
