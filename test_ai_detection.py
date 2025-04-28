#!/usr/bin/env python3
"""
Test script for the ai_detection module.

This script tests both detection script generation methods with various app names
and prints the results to the terminal.
"""

import time
import argparse
import json
import sys
import requests
from api.functions.ai_detection import (
    generate_detection_script, 
    generate_detection_script_with_function_calling,
    OPENAI_API_KEY
)

# Test app names representing different types of applications
TEST_APPS = [
    "Microsoft Office 365",
    "Google Chrome",
    "Adobe Acrobat Reader DC",
    "Mozilla Firefox",
    "Zoom Client for Meetings",
    "Microsoft Teams",
    "VLC Media Player",
    "7-Zip",
    "Notepad++",
    "Visual Studio Code"
]

def verify_api_key():
    """Verify the OpenAI API key is valid."""
    print("Verifying API key...")
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {OPENAI_API_KEY}"
    }
    
    try:
        # Simple models list request to check key validity
        response = requests.get(
            "https://api.openai.com/v1/models",
            headers=headers
        )
        if response.status_code == 200:
            print("✓ API key is valid")
            return True
        else:
            print(f"✗ API key is invalid. Error: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"✗ Error checking API key: {str(e)}")
        return False

def test_manual_api_call(app_name):
    """Test a direct API call to rule out issues with our wrapper."""
    print("\nTesting direct API call...")
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {OPENAI_API_KEY}"
    }
    
    payload = {
        "model": "gpt-3.5-turbo",  # Using a simpler model for testing
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": f"Write a short PowerShell script to detect if {app_name} is installed."}
        ]
    }
    
    try:
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json=payload
        )
        print(f"Status code: {response.status_code}")
        if response.status_code == 200:
            print("✓ Direct API call successful")
            # Just show a brief snippet
            content = response.json()["choices"][0]["message"]["content"]
            print(f"Response snippet: {content[:100]}...")
            return True
        else:
            print(f"✗ Direct API call failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"✗ Error making direct API call: {str(e)}")
        return False

def test_detection_script_generation(app_name, use_predicted_outputs=True, use_function_calling=False):
    """Test generating a detection script for a specific app."""
    print(f"\n{'=' * 80}")
    print(f"Generating detection script for: {app_name}")
    print(f"Method: {'Function Calling' if use_function_calling else 'Standard'}")
    print(f"Predicted Outputs: {'Enabled' if use_predicted_outputs and not use_function_calling else 'Disabled'}")
    print(f"{'-' * 80}")
    
    try:
        start_time = time.time()
        
        if use_function_calling:
            script = generate_detection_script_with_function_calling(app_name)
        else:
            script = generate_detection_script(app_name, use_predicted_outputs=use_predicted_outputs)
        
        elapsed_time = time.time() - start_time
        
        print(f"Generation completed in {elapsed_time:.2f} seconds")
        print(f"{'-' * 80}")
        print("DETECTION SCRIPT:")
        print(f"{'-' * 80}")
        print(script)
        
        return True, elapsed_time
    except Exception as e:
        print(f"Error generating script: {str(e)}")
        return False, 0

def main():
    parser = argparse.ArgumentParser(description='Test Intune app detection script generation')
    parser.add_argument('--apps', type=str, nargs='+', 
                        help='Specific app names to test (default: use predefined list)')
    parser.add_argument('--all', action='store_true', 
                        help='Test all methods (with and without predicted outputs)')
    parser.add_argument('--function-calling', action='store_true', 
                        help='Use function calling method')
    parser.add_argument('--no-predicted-outputs', action='store_true', 
                        help='Disable predicted outputs')
    parser.add_argument('--debug', action='store_true',
                        help='Run debugging tools first')
    
    args = parser.parse_args()
    
    # Print the Python version
    print(f"Python version: {sys.version}")
    
    # Check if API key is properly set
    if OPENAI_API_KEY == "your-api-key-here":
        print("❌ ERROR: API key not set. Please add your OpenAI API key to api/functions/ai_detection.py")
        return
    
    # Run debugging first
    if args.debug or len(sys.argv) == 1:
        if not verify_api_key():
            print("\n❌ API key verification failed. Please check your OpenAI API key.")
            print("The key should begin with 'sk-' for a secret key.")
            return
        
        # Try a simple direct API call to diagnose issues
        test_manual_api_call("Google Chrome")
    
    # Determine which apps to test
    apps_to_test = args.apps if args.apps else TEST_APPS[:2]  # Default to first 2 apps
    
    # Determine which methods to test
    if args.all:
        methods = [
            {"name": "Standard with Predicted Outputs", "function_calling": False, "predicted_outputs": True},
            {"name": "Standard without Predicted Outputs", "function_calling": False, "predicted_outputs": False},
            {"name": "Function Calling", "function_calling": True, "predicted_outputs": False}
        ]
    else:
        use_function_calling = args.function_calling
        use_predicted_outputs = not args.no_predicted_outputs and not use_function_calling
        methods = [
            {"name": f"{'Function Calling' if use_function_calling else 'Standard'} "
                    f"{'with Predicted Outputs' if use_predicted_outputs else ''}",
             "function_calling": use_function_calling,
             "predicted_outputs": use_predicted_outputs}
        ]
    
    # Print test configuration
    print("\nTESTING INTUNE APP DETECTION SCRIPT GENERATION")
    print(f"Apps to test: {', '.join(apps_to_test)}")
    print(f"Methods to test: {', '.join([m['name'] for m in methods])}")
    
    # Run tests
    results = []
    for app in apps_to_test:
        for method in methods:
            success, elapsed_time = test_detection_script_generation(
                app,
                use_predicted_outputs=method["predicted_outputs"],
                use_function_calling=method["function_calling"]
            )
            results.append({
                "app": app,
                "method": method["name"],
                "success": success,
                "time": elapsed_time
            })
    
    # Print summary
    print("\nTEST SUMMARY")
    print(f"{'-' * 80}")
    print(f"{'App':<30} | {'Method':<35} | {'Success':<7} | {'Time (s)':<10}")
    print(f"{'-' * 80}")
    for result in results:
        success_str = "✓" if result["success"] else "✗"
        time_str = f"{result['time']:.2f}" if result["success"] else "N/A"
        print(f"{result['app']:<30} | {result['method']:<35} | {success_str:<7} | {time_str:<10}")
    
    successful_tests = sum(1 for r in results if r["success"])
    print(f"{'-' * 80}")
    print(f"Completed {len(results)} tests, {successful_tests} successful, "
          f"{len(results) - successful_tests} failed")

if __name__ == "__main__":
    main()
