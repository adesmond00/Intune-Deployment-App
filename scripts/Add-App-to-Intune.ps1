#Requires -Modules Microsoft.Graph.Authentication

# Import necessary modules explicitly
Import-Module Microsoft.Graph.Authentication -ErrorAction SilentlyContinue

<#
.SYNOPSIS
    Creates a new Win32 application in Microsoft Intune using direct Graph API calls.

.DESCRIPTION
    The Add-AppToIntune function creates a new Win32 application (#microsoft.graph.win32LobApp)
    in Microsoft Intune by interacting directly with the Microsoft Graph API.
    This approach avoids dependencies on the IntuneWin32App module.

.PARAMETER AccessToken
    A valid Microsoft Graph Access Token for authentication. This token must have the necessary permissions
    (e.g., DeviceManagementApps.ReadWrite.All) to create applications in Intune.

.PARAMETER IntuneWinFile
    The path to the .intunewin file that contains the packaged Win32 application.

.PARAMETER DisplayName
    The display name of the application.

.PARAMETER Description
    A detailed description of the application.

.PARAMETER Publisher
    The name of the application publisher.

.PARAMETER InstallExperience
    Specifies how the application should be installed ("system" or "user").

.PARAMETER RestartBehavior
    Defines the restart behavior ("suppress", "force", "basedOnReturnCode").

.PARAMETER Rules
    (Optional) A JSON string representing an array of rule objects (detection and requirement) matching the Graph API schema.
    The backend API constructs this string. Defaults to an empty array '[]'.
    Example JSON string content:
    '[
      { "@odata.type": "#microsoft.graph.win32LobAppPowerShellScriptDetection", "scriptContent": "BASE64...", "runAs32Bit": true },
      { "@odata.type": "#microsoft.graph.win32LobAppRequirement", "operator": "greaterOrEqual", "detectionType": "version", "value": "10.0.10240" }
    ]'

.PARAMETER InstallCommandLine
    The command line used to install the application silently.

.PARAMETER UninstallCommandLine
    The command line used to uninstall the application silently.

.PARAMETER MinimumSupportedOperatingSystem
    (Optional) A hashtable representing the minimum OS required. Example: @{v10_0 = $true} for Windows 10.

.PARAMETER SetupFilePath
    (Optional) Relative path of the setup file within the .intunewin package (e.g., "setup.exe"). Often not needed if InstallCommandLine includes the filename.

.EXAMPLE
    # Note: Detection/Requirement rules need to be constructed as PS Custom Objects matching Graph schema
    $detectionRule = [PSCustomObject]@{
        '@odata.type' = '#microsoft.graph.win32LobAppMsiInformation'
        productCode = '{23170F69-40C1-2702-1900-000001000000}'
        # productVersion = '...' # Optional
        # upgradeCode = '...' # Optional
    }
    $rulesJson = '[{"@odata.type":"#microsoft.graph.win32LobAppPowerShellScriptDetection","scriptContent":"IyBQb3dlclNoZWxsIFNjcmlwdA0KDQpFeGl0IDANCg==","runAs32Bit":true},{"@odata.type":"#microsoft.graph.win32LobAppRequirement","operator":"greaterOrEqual","detectionType":"version","value":"10.0.10240"}]'

    Add-AppToIntune -AccessToken "YOUR_ACCESS_TOKEN" `
                    -IntuneWinFile "C:\Packages\7zip.intunewin" `
                    -DisplayName "7-Zip (Graph API)" `
                    -Description "7-Zip file archiver via Graph" `
                    -Publisher "Igor Pavlov" `
                    -InstallExperience "system" `
                    -RestartBehavior "suppress" `
                    -Rules $rulesJson `
                    -InstallCommandLine "msiexec /i 7zip.msi /qn" `
                    -UninstallCommandLine "msiexec /x {23170F69-40C1-2702-1900-000001000000} /qn"

.NOTES
    - Requires a valid Microsoft Graph Access Token with DeviceManagementApps.ReadWrite.All permission.
    - File upload currently attempts a single PUT request, suitable for smaller files. Chunked upload is recommended for large files (>60MB).
    - The -Rules parameter expects a JSON string representing an array of rule objects. The backend API is responsible for constructing this string correctly.
    - Error handling is basic; more robust checks on API responses might be needed.
#>
function Add-AppToIntune {
    [CmdletBinding(SupportsShouldProcess = $true)]
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

        [Parameter(Mandatory = $false)] # Rules are technically optional in Graph
        [string]$Rules = '[]', # Expecting JSON string from API, default to empty JSON array

        [Parameter(Mandatory = $true)]
        [string]$InstallCommandLine,

        [Parameter(Mandatory = $true)]
        [string]$UninstallCommandLine,

        [Parameter(Mandatory = $false)]
        [hashtable]$MinimumSupportedOperatingSystem = @{ V10_0 = $true }, # Default to Win 10

        [Parameter(Mandatory = $false)]
        [string]$SetupFilePath = $null # Relative path within package if needed
    )

    $ErrorActionPreference = 'Stop'
    $VerbosePreference = 'Continue' # Enable verbose output
    $result = @{ success = $false; output = $null; error = $null }
    $graphApiBaseUrl = "https://graph.microsoft.com/v1.0"
    $mobileAppsUrl = "$graphApiBaseUrl/deviceAppManagement/mobileApps"

    try {
        Write-Verbose "Script started. Validating parameters..."

        # --- Parameter Validation ---
        if (-not (Test-Path -Path $IntuneWinFile -PathType Leaf)) {
            throw "IntuneWin file not found at path: $IntuneWinFile"
        }
        if (-not $AccessToken) { throw "AccessToken is required." }
        # Add more validation as needed

        # --- Prepare Headers ---
        $headers = @{
            "Authorization" = "Bearer $AccessToken"
            "Content-Type"  = "application/json"
            "Accept"        = "application/json"
        }

        # --- 1. Create the initial Win32LobApp object ---
        Write-Verbose "Step 1: Creating initial Win32LobApp object..."
        $appPayload = @{
            "@odata.type"                     = "#microsoft.graph.win32LobApp"
            displayName                       = $DisplayName
            description                       = $Description
            publisher                         = $Publisher
            installCommandLine                = $InstallCommandLine
            uninstallCommandLine              = $UninstallCommandLine
            installExperience                 = $InstallExperience # Note: Graph uses 'runAsAccount'
            minimumSupportedOperatingSystem   = $MinimumSupportedOperatingSystem
            setupFilePath                     = $SetupFilePath # Relative path in package if needed
            # Other properties like 'notes', 'owner', 'developer', 'informationUrl', 'privacyUrl' can be added here
            # 'committedContentVersion' will be set after upload
        } | ConvertTo-Json -Depth 5

        Write-Verbose "App Payload: $appPayload"

        $createAppResponse = Invoke-RestMethod -Uri $mobileAppsUrl -Method Post -Headers $headers -Body $appPayload -ErrorAction Stop
        $appId = $createAppResponse.id
        Write-Verbose "Successfully created app object with ID: $appId"

        # --- 2. Create Content Version ---
        Write-Verbose "Step 2: Creating content version..."
        $contentVersionUrl = "$mobileAppsUrl/$appId/contentVersions"
        $contentVersionPayload = @{
            "@odata.type" = "#microsoft.graph.mobileAppContent"
        } | ConvertTo-Json

        $createContentVersionResponse = Invoke-RestMethod -Uri $contentVersionUrl -Method Post -Headers $headers -Body $contentVersionPayload -ErrorAction Stop
        $contentVersionId = $createContentVersionResponse.id
        Write-Verbose "Successfully created content version with ID: $contentVersionId"

        # --- 3. Create File Entry ---
        Write-Verbose "Step 3: Creating file entry..."
        $fileInfo = Get-Item -Path $IntuneWinFile
        $fileSize = $fileInfo.Length
        $fileName = $fileInfo.Name

        $fileEntryUrl = "$mobileAppsUrl/$appId/contentVersions/$contentVersionId/files"
        $fileEntryPayload = @{
            "@odata.type" = "#microsoft.graph.mobileAppContentFile"
            name          = $fileName
            size          = $fileSize
            # isDependency = $false # Default
            # manifest = $null # Optional base64 encoded manifest
        } | ConvertTo-Json

        $createFileEntryResponse = Invoke-RestMethod -Uri $fileEntryUrl -Method Post -Headers $headers -Body $fileEntryPayload -ErrorAction Stop
        $fileId = $createFileEntryResponse.id
        Write-Verbose "Successfully created file entry with ID: $fileId"

        # --- 4. Get SAS URI and Commit File ---
        Write-Verbose "Step 4: Committing file entry to get SAS URI..."
        $commitUrl = "$mobileAppsUrl/$appId/contentVersions/$contentVersionId/files/$fileId/commit"
        $commitPayload = @{
            "@odata.type"    = "#microsoft.graph.mobileAppContentFile"
            # fileEncryptionInfo = $null # If needed
        } | ConvertTo-Json

        $commitResponse = Invoke-RestMethod -Uri $commitUrl -Method Post -Headers $headers -Body $commitPayload -ErrorAction Stop
        $sasUri = $commitResponse.azureStorageUri
        $sasUriExpiration = $commitResponse.azureStorageUriExpirationDateTime
        Write-Verbose "Obtained SAS URI (expires: $sasUriExpiration)"

        # --- 5. Upload File Content ---
        Write-Verbose "Step 5: Uploading file content to SAS URI..."
        # Read file content as byte array
        $fileBytes = [System.IO.File]::ReadAllBytes($IntuneWinFile)

        # Prepare headers for Azure Blob Storage PUT request
        $uploadHeaders = @{
            "x-ms-blob-type" = "BlockBlob"
            # "Content-Length" = $fileSize # Invoke-RestMethod might handle this
        }

        # Perform the upload (single PUT for now, consider chunking for large files)
        # Note: Invoke-RestMethod might have size limits. AzCopy or Azure.Storage.Blobs module are more robust for large files.
        Invoke-RestMethod -Uri $sasUri -Method Put -Headers $uploadHeaders -Body $fileBytes -ContentType "application/octet-stream" -ErrorAction Stop
        Write-Verbose "Successfully uploaded file content."

        # --- 6. Update App with Final Details (Install Behavior, Detection, Requirements) ---
        Write-Verbose "Step 6: Updating app object with final details..."
        $patchUrl = "$mobileAppsUrl/$appId"
        $patchPayload = @{
            "@odata.type"           = "#microsoft.graph.win32LobApp" # Important to specify type again for PATCH
            committedContentVersion = $contentVersionId # Link the uploaded content
            installExperience       = @{ # Map to nested object
                runAsAccount = $InstallExperience
            }
            returnCodes             = @( # Default return codes, can be customized
                @{ returnCode = 0; type = 'success' }
                @{ returnCode = 1707; type = 'success' }
                @{ returnCode = 3010; type = 'softReboot' }
                @{ returnCode = 1641; type = 'hardReboot' }
                @{ returnCode = 1618; type = 'retry' }
            )
            # Parse the JSON string passed via -Rules parameter into PowerShell objects
            rules                   = ($Rules | ConvertFrom-Json)
        }

        # Convert the final payload, ensuring sufficient depth for nested rules
        $patchPayloadJson = $patchPayload | ConvertTo-Json -Depth 5

        Write-Verbose "Patch Payload JSON: $patchPayloadJson"

        # Use PATCH method for updates
        $patchHeaders = $headers.Clone() # Clone original headers
        $patchHeaders["Content-Type"] = "application/json" # Ensure content type is JSON

        $updateResponse = Invoke-RestMethod -Uri $patchUrl -Method Patch -Headers $patchHeaders -Body $patchPayloadJson -ErrorAction Stop
        Write-Verbose "Successfully patched application object."

        # --- Success ---
        $result.success = $true
        $result.output = $updateResponse | Select-Object -Property Id, DisplayName, Publisher, CreatedDateTime, LastModifiedDateTime, Version | ConvertTo-Json -Depth 3
        Write-Verbose "Application '$DisplayName' added/updated successfully via Graph API."

    } catch {
        Write-Error "Error adding application '$DisplayName' via Graph API: $($_.Exception.Message)"
        # Try to get more details from the response if it's a WebException
        if ($_.Exception -is [System.Net.WebException]) {
            $response = $_.Exception.Response
            if ($response) {
                $streamReader = [System.IO.StreamReader]::new($response.GetResponseStream())
                $errorBody = $streamReader.ReadToEnd()
                $streamReader.Dispose()
                Write-Error "API Error Response: $errorBody"
                $result.error = "API Error: $errorBody"
            } else {
                 $result.error = "Error: $($_.Exception.Message)"
            }
        } else {
            $result.error = "Error: $($_.Exception.Message)"
        }
        Write-Error $_.ScriptStackTrace
        # Output error details to stderr as JSON
        Write-Error ($result | ConvertTo-Json -Depth 3)
        exit 1 # Indicate failure
    } finally {
        # Disconnect is generally not needed for token-based auth with Invoke-RestMethod
        # Output final result to stdout as JSON if successful
        if ($result.success) {
            Write-Output ($result | ConvertTo-Json -Depth 3)
        }
    }
}

# Example of how to call this if run directly (requires manual token input & rule objects)
# if ($MyInvocation.MyCommand.CommandOrigin -eq 'Runspace') {
#     $token = Read-Host -Prompt "Enter Access Token"
#     # Define $detectionRule, $requirementRule, etc. as PSCustomObjects here...
#     # Add-AppToIntune -AccessToken $token ... other params
# }
