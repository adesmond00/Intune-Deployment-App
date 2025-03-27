# Connects to Intune using the Microsoft Graph API
# Installs the IntuneWin32App and Microsoft.Graph.Intune modules


function Initialize-IntuneConnection {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory = $true)]
        [string]$TenantID,
        
        [Parameter(Mandatory = $false)]
        [string]$ClientID = "14d82eec-204b-4c2f-b7e8-296a70dab67e"
    )

    try {
        # Install required modules if not present
        $requiredModules = @(
            "IntuneWin32App",
            "Microsoft.Graph.Intune"
        )

        foreach ($module in $requiredModules) {
            Write-Verbose "Checking for module: $module"
            $moduleInstalled = Get-InstalledModule -Name $module -ErrorAction SilentlyContinue
            
            if (-not $moduleInstalled) {
                Write-Verbose "Installing module: $module"
                Install-Module -Name $module -Force
            } else {
                Write-Verbose "Module $module is already installed"
            }
        }

        # Import modules
        Write-Verbose "Importing required modules"
        Import-Module -Name "IntuneWin32App"
        Import-Module -Name "Microsoft.Graph.Intune"

        # Connect to Microsoft Graph
        Write-Verbose "Connecting to Microsoft Graph with TenantID: $TenantID"
        Connect-MSIntuneGraph -TenantID $TenantID -ClientID $ClientID -Interactive

        return @{
            Success = $true
            Message = "Successfully connected to Microsoft Graph"
        }
    }
    catch {
        Write-Error "Failed to initialize Intune connection: $_"
        return @{
            Success = $false
            Error = $_.Exception.Message
        }
    }
}

# Example usage:
<#
$result = Initialize-IntuneConnection -TenantID "your-tenant-id" -Verbose

if ($result.Success) {
    Write-Host $result.Message
} else {
    Write-Error "Failed to connect: $($result.Error)"
}
#>