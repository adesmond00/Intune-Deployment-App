import subprocess
import re
from typing import List, Dict, Any

def search_winget_packages(search_term: str) -> List[Dict[str, str]]:
    """
    Search for packages using winget and return structured JSON data.
    
    Args:
        search_term (str): The term to search for in winget
        
    Returns:
        List[Dict[str, str]]: A list of applications, each represented as a dictionary
                              with keys "Name", "Id", "Version", and "Source".
    """
    try:
        # Execute winget search command
        result = subprocess.run(
            ["powershell", "-Command", f"winget search {search_term} --accept-source-agreements"],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='ignore'
        )
        
        if result.returncode != 0:
            print(f"Winget search failed with error: {result.stderr}")
            return []
            
        raw_output = result.stdout
        if not raw_output:
            return []
            
        # Split output into lines and find the header
        lines = raw_output.strip().split('\n')
        header_index = -1
        
        # Find the header line containing column names
        for i, line in enumerate(lines):
            if re.search(r'\bName\b.*\bId\b.*\bVersion\b.*\bSource\b', line, re.IGNORECASE):
                header_index = i
                break
                
        if header_index == -1:
            print("Could not find header line in winget output")
            return []
            
        # Find column positions from header
        header_line = lines[header_index]
        name_match = re.search(r'\bName\b', header_line, re.IGNORECASE)
        id_match = re.search(r'\bId\b', header_line, re.IGNORECASE)
        version_match = re.search(r'\bVersion\b', header_line, re.IGNORECASE)
        source_match = re.search(r'\bSource\b', header_line, re.IGNORECASE)
        
        if not all([name_match, id_match, version_match, source_match]):
            print("Could not find all required column names in header")
            return []
            
        # Get column start positions
        name_start = name_match.start()
        id_start = id_match.start()
        version_start = version_match.start()
        source_start = source_match.start()
        
        # Process data lines (skip header and separator)
        apps = []
        for line in lines[header_index + 2:]:
            line = line.rstrip()
            if not line.strip():
                continue
                
            # Extract fields based on column positions
            name = line[name_start:id_start].strip()
            id_part = line[id_start:version_start].strip()
            version = line[version_start:source_start].strip()
            source = line[source_start:].strip()
            
            # Only include entries with both name and id
            if name and id_part:
                apps.append({
                    "Name": name,
                    "Id": id_part,
                    "Version": version,
                    "Source": source
                })
                
        return apps
        
    except Exception as e:
        print(f"Error searching winget packages: {str(e)}")
        return []
