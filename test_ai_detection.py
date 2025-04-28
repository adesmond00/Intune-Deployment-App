#!/usr/bin/env python3
"""
Simple test script for AI-generated detection scripts.

This script calls the generate_detection_script function with various app names
and prints the resulting detection scripts to the terminal for review.

Usage:
    python3 test_ai_detection.py [app_name1] [app_name2] ...

If no app names are provided, a default set of examples will be used.
"""

import sys
from api.functions.ai_detection import generate_detection_script


def main():
    # If app names are provided as command line arguments, use those
    app_names = sys.argv[1:] if len(sys.argv) > 1 else [
        "7-Zip", 
        "Visual Studio Code",
        "Google Chrome",
        "Microsoft Office 365",
        "Notepad++",
        "Adobe Acrobat Reader",
    ]

    for app_name in app_names:
        print(f"\n{'=' * 80}")
        print(f"Detection script for: {app_name}")
        print(f"{'=' * 80}")
        
        try:
            script = generate_detection_script(app_name)
            
            # Print script with line numbers for easier reference
            for i, line in enumerate(script.splitlines(), 1):
                print(f"{i:2d} | {line}")
                
            # Additional validation info
            print(f"\n✓ Script length: {len(script)} chars")
            has_exit0 = "exit 0" in script.lower()
            print(f"✓ Exit 0: {'Yes' if has_exit0 else 'NO - MISSING!'}")
            
            has_output = any(cmd in script for cmd in ["Write-Output", "Write-Host"])
            print(f"✓ STDOUT output: {'Yes' if has_output else 'NO - MISSING!'}")
            
        except Exception as e:
            print(f"ERROR generating script: {e}")
        
        print("\n")


if __name__ == "__main__":
    main()
