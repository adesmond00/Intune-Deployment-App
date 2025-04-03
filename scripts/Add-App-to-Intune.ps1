#Requires -Modules Microsoft.Graph.Authentication, IntuneWin32App

# Import necessary modules explicitly
Import-Module Microsoft.Graph.Authentication -ErrorAction SilentlyContinue
Import-Module IntuneWin32App -ErrorAction SilentlyContinue

<#
.SYNOPSIS
    Creates a new Win32 application in Microsoft Intune.

.DESCRIPTION
    The Add-AppToIntune cmdlet creates a new Win32 application in Microsoft Intune. This cmdlet is used to deploy
    traditional Windows applications (.exe, .msi) through Intune's Win32 app deployment feature.

.PARAMETER IntuneWinFile
    The path to the .intunewin file that contains the packaged Win32 application. This file must be created using
    the New-IntuneWin32AppPackage cmdlet before using this command.

.PARAMETER DisplayName
    The display name of the application as it will appear in the Microsoft Endpoint Manager admin center and
    to end users. This should be descriptive and unique.

.PARAMETER Description
    A detailed description of the application and its purpose. This helps administrators and users understand
    what the application does.

.PARAMETER Publisher
    The name of the application publisher or vendor. This helps in organizing and identifying applications
    from different vendors.

.PARAMETER InstallExperience
    Specifies how the application should be installed. Valid values are:
    - "system": Installs the application in the system context (recommended for most scenarios)
    - "user": Installs the application in the user context

.PARAMETER RestartBehavior
    Defines the restart behavior after installation. Valid values are:
    - "suppress": Prevents automatic restart after installation
    - "force": Forces a restart after installation
    - "basedOnReturnCode": Restarts based on the return code of the installation

.PARAMETER DetectionRule
    Specifies the rules used to detect if the application is already installed on a device. This is created using
    one of the New-IntuneWin32AppDetectionRule* cmdlets (e.g., New-IntuneWin32AppDetectionRuleMSI for MSI-based
    applications).

.PARAMETER RequirementRule
    Defines the prerequisites that must be met on a device before the application can be installed. This is created
    using the New-IntuneWin32AppRequirementRule cmdlet and can specify requirements like minimum OS version and
    system architecture.

.PARAMETER InstallCommandLine
    The command line used to install the application. This should be the full command including any arguments
    or switches needed for silent installation.

.PARAMETER UninstallCommandLine
    The command line used to uninstall the application. This should be the full command including any arguments
    or switches needed for silent uninstallation.

.EXAMPLE
    $detectionRule = New-IntuneWin32AppDetectionRuleMSI -ProductCode "{23170F69-40C1-2702-1900-000001000000}"
    $requirementRule = New-IntuneWin32AppRequirementRule -Architecture "x64" -MinimumSupportedWindowsRelease "1909"
    
    Add-AppToIntune -IntuneWinFile "C:\Packages\7zip.intunewin" `
                    -DisplayName "7-Zip" `
                    -Description "7-Zip file archiver" `
                    -Publisher "Igor Pavlov" `
                    -InstallExperience "system" `
                    -RestartBehavior "suppress" `
                    -DetectionRule $detectionRule `
                    -RequirementRule $requirementRule `
                    -InstallCommandLine "msiexec /i 7zip.msi /qn" `
                    -UninstallCommandLine "msiexec /x {23170F69-40C1-2702-1900-000001000000} /qn"

.NOTES
    - This cmdlet requires appropriate permissions in Microsoft Intune
    - The .intunewin file must be created before using this command
    - Detection and requirement rules must be properly configured for successful deployment
    - The application will not be assigned to any users or devices by default; assignments must be created separately
    - Requires a valid Microsoft Graph Access Token with appropriate permissions (e.g., DeviceManagementApps.ReadWrite.All).

.PARAMETER AccessToken
    A valid Microsoft Graph Access Token for authentication. This token must have the necessary permissions
    to create applications in Intune.
#>


#Adds the app to Intune as a win32 App
function Add-AppToIntune {
    [CmdletBinding(SupportsShouldProcess = $true)] # Added SupportsShouldProcess
    param(
        [Parameter(Mandatory = $true)]
        [string]$AccessToken,

        [Parameter(Mandatory = $true)]
        [string]$IntuneWinFile,

        [Parameter(Mandatory = $true)] 
        [string]$DisplayName,

        [Parameter(Mandatory = $true)]
        [string]$Description,

        [Parameter(Mandatory = $true)]
        [string]$Publisher,

        [Parameter(Mandatory = $true)]
        [ValidateSet("system", "user")]
        [string]$InstallExperience = "system",

        [Parameter(Mandatory = $true)]
        [ValidateSet("suppress", "force", "basedOnReturnCode")]
        [string]$RestartBehavior = "suppress",

        [Parameter(Mandatory = $true)]
        $DetectionRule,

        [Parameter(Mandatory = $true)]
        $RequirementRule,

        [Parameter(Mandatory = $true)]
        [string]$InstallCommandLine,

        [Parameter(Mandatory = $true)]
        [string]$UninstallCommandLine
    )

    $ErrorActionPreference = 'Stop' # Stop on terminating errors
    $result = @{ success = $false; output = $null; error = $null }

    try {
        Write-Verbose "Attempting to connect to Microsoft Graph with provided access token."
        # Convert the token string to a SecureString
        $secureToken = ConvertTo-SecureString -String $AccessToken -AsPlainText -Force
        Connect-MgGraph -AccessToken $secureToken
        Write-Verbose "Successfully connected to Microsoft Graph."

        # Check if modules are available after attempting import
        if (-not (Get-Module -Name Microsoft.Graph.Authentication) -or -not (Get-Module -Name IntuneWin32App)) {
             throw "Required PowerShell modules (Microsoft.Graph.Authentication, IntuneWin32App) are not available."
        }

        # Prepare parameters for Add-IntuneWin32App
        $addParams = @{
            FilePath            = $IntuneWinFile
            DisplayName         = $DisplayName
            Description         = $Description
            Publisher           = $Publisher
            InstallExperience   = $InstallExperience
            RestartBehavior     = $RestartBehavior
            DetectionRule       = $DetectionRule
            RequirementRule     = $RequirementRule
            InstallCommandLine  = $InstallCommandLine
            UninstallCommandLine = $UninstallCommandLine
            Verbose             = $true # Keep verbose logging from the cmdlet
        }

        Write-Verbose "Calling Add-IntuneWin32App with parameters:"
        Write-Verbose ($addParams | Out-String)

        if ($PSCmdlet.ShouldProcess($DisplayName, "Add Win32 App to Intune")) {
            # Execute the command
            $intuneApp = Add-IntuneWin32App @addParams
            
            if ($intuneApp) {
                Write-Verbose "Successfully added application '$DisplayName' to Intune."
                $result.success = $true
                # Select relevant properties to return, convert to JSON friendly format
                $result.output = $intuneApp | Select-Object -Property Id, DisplayName, Publisher, CreatedDateTime, LastModifiedDateTime, Version | ConvertTo-Json -Depth 3 
            } else {
                throw "Add-IntuneWin32App command did not return an application object."
            }
        } else {
             Write-Warning "Operation cancelled by ShouldProcess."
             $result.error = "Operation cancelled by ShouldProcess."
        }

    } catch {
        Write-Error "Error adding application '$DisplayName' to Intune: $($_.Exception.Message)"
        Write-Error $_.ScriptStackTrace
        $result.error = "Error adding application '$DisplayName': $($_.Exception.Message)"
        # Output error details to stderr as JSON
        Write-Error ($result | ConvertTo-Json -Depth 3)
        # Exit with non-zero code to indicate failure to the caller
        exit 1 
    } finally {
         # Disconnect if needed, though token-based connection is usually stateless per command
         # Disconnect-MgGraph -ErrorAction SilentlyContinue 
         
         # Output final result to stdout as JSON if successful
         if ($result.success) {
             Write-Output ($result | ConvertTo-Json -Depth 3)
         }
    }
}

# Example of how to call this if run directly (requires manual token input)
# if ($MyInvocation.MyCommand.CommandOrigin -eq 'Runspace') {
#     $token = Read-Host -Prompt "Enter Access Token"
#     # Add other parameter values here...
#     Add-AppToIntune -AccessToken $token # ... other params
# }
