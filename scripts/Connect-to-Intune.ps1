# Connects to Intune using the Microsoft Graph API
# Returns JSON result for the frontend application

function Initialize-IntuneConnection {
    [CmdletBinding()]
    param (
        [Parameter(Mandatory = $false)]
        [string]$TenantID,
        
        [Parameter(Mandatory = $false)]
        [string]$ClientID
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
            }
        }

        # Import modules
        Write-Verbose "Importing required modules"
        Import-Module -Name "IntuneWin32App"
        Import-Module -Name "Microsoft.Graph.Intune"

        # Connect to Microsoft Graph
        Write-Verbose "Connecting to Microsoft Graph"
        if ($TenantID) {
            Connect-MSIntuneGraph -TenantID $TenantID -ClientID $ClientID -Interactive
        } else {
            Connect-MSIntuneGraph -Interactive
        }

        # Get current context
        $context = Get-AzContext
        $tenantId = $context.Tenant.Id

        # Return success result as JSON
        @{
            Success = $true
            Message = "Successfully connected to Microsoft Graph"
            TenantID = $tenantId
        } | ConvertTo-Json
    }
    catch {
        Write-Error "Failed to initialize Intune connection: $_"
        @{
            Success = $false
            Error = $_.Exception.Message
        } | ConvertTo-Json
    }
}

# Execute the connection
Initialize-IntuneConnection

# Example usage:
<#
$result = Initialize-IntuneConnection -TenantID "your-tenant-id" -Verbose

if ($result.Success) {
    Write-Host $result.Message
} else {
    Write-Error "Failed to connect: $($result.Error)"
}
#>