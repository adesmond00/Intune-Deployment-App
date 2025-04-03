# Ensures required PowerShell modules for Intune interaction are installed.
# Returns JSON result indicating success or failure.

function Ensure-RequiredModules {
    [CmdletBinding()]
    param () # No parameters needed for this version

    $ErrorActionPreference = 'Stop' # Stop on terminating errors
    $result = @{ success = $false; message = $null; error = $null }
    $modulesInstalled = @{} # Track installation status

    try {
        # Define required modules for token auth and Win32 app management
        $requiredModules = @(
            "Microsoft.Graph.Authentication", # Needed for Connect-MgGraph -AccessToken
            "IntuneWin32App"                # Needed for Add-IntuneWin32App etc.
        )

        # Attempt to find/install modules
        foreach ($moduleName in $requiredModules) {
            Write-Verbose "Checking for module: $moduleName"
            $moduleAvailable = Get-Module -Name $moduleName -ListAvailable -ErrorAction SilentlyContinue
            
            if (-not $moduleAvailable) {
                Write-Warning "Module '$moduleName' not found. Attempting installation..."
                try {
                    # Install for current user to avoid needing admin rights
                    Install-Module -Name $moduleName -Force -Scope CurrentUser -AllowClobber -Repository PSGallery -ErrorAction Stop
                    Write-Verbose "Successfully installed module: $moduleName"
                    # Verify installation
                    $moduleAvailable = Get-Module -Name $moduleName -ListAvailable -ErrorAction SilentlyContinue
                    if (-not $moduleAvailable) {
                        throw "Failed to verify module '$moduleName' after installation attempt."
                    }
                    $modulesInstalled[$moduleName] = $true
                } catch {
                    throw "Failed to install required module '$moduleName'. Error: $($_.Exception.Message)"
                }
            } else {
                Write-Verbose "Module '$moduleName' is already available."
                $modulesInstalled[$moduleName] = $true
            }
        }

        # Final check if all modules are now available
        $allModulesAvailable = $true
        foreach ($moduleName in $requiredModules) {
            if (-not $modulesInstalled.ContainsKey($moduleName) -or (-not $modulesInstalled[$moduleName])) {
                $allModulesAvailable = $false
                $result.error = "Module '$moduleName' could not be installed or verified."
                break # Exit loop on first failure
            }
        }

        if ($allModulesAvailable) {
            $result.success = $true
            $result.message = "All required modules (Microsoft.Graph.Authentication, IntuneWin32App) are available."
        } else {
             # Error message already set in the loop
             throw $result.error
        }

    } catch {
        $errorMessage = "Failed to ensure required modules. Error: $($_.Exception.Message)"
        Write-Error $errorMessage
        $result.error = $errorMessage
        # Output error details to stderr as JSON
        Write-Error ($result | ConvertTo-Json -Depth 3)
        # Exit with non-zero code to indicate failure to the caller
        exit 1
    } finally {
         # Output final result to stdout as JSON if successful
         if ($result.success) {
             Write-Output ($result | ConvertTo-Json -Depth 3)
         }
    }
}

# Execute the module check
Ensure-RequiredModules
