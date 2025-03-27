Import-Module -Name "IntuneWin32App"

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
#>


#Adds the app to Intune as a win32 App
function Add-AppToIntune {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$IntuneWinFile,

        [Parameter(Mandatory = $true)] 
        [string]$DisplayName,

        [Parameter(Mandatory = $true)]
        [string]$Description,

        [Parameter(Mandatory = $true)]
        [string]$Publisher,

        [Parameter(Mandatory = $false)]
        [ValidateSet("system", "user")]
        [string]$InstallExperience = "system",

        [Parameter(Mandatory = $false)]
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

    return Add-IntuneWin32App -FilePath $IntuneWinFile `
        -DisplayName $DisplayName `
        -Description $Description `
        -Publisher $Publisher `
        -InstallExperience $InstallExperience `
        -RestartBehavior $RestartBehavior `
        -DetectionRule $DetectionRule `
        -RequirementRule $RequirementRule `
        -InstallCommandLine $InstallCommandLine `
        -UninstallCommandLine $UninstallCommandLine `
        -Verbose
}


