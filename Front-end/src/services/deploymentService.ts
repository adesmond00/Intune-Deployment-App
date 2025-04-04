import { authService } from './authService';
import { StagedAppDeploymentInfo } from '../pages/WingetAppPage';

interface IntuneAppResponse {
    Id: string;
    DisplayName: string;
    Publisher: string;
    CreatedDateTime: string;
    LastModifiedDateTime: string;
    Version: string;
}

interface DeploymentResult {
    success: boolean;
    appId: string;
    intuneAppId?: string;
    output?: IntuneAppResponse;
    error?: string;
}

interface DeploymentProgress {
    total: number;
    completed: number;
    currentApp?: string;
    results: DeploymentResult[];
}

/**
 * Validates that the app was successfully created in Intune
 * @param response The response from the PowerShell script
 * @returns true if the app was created successfully
 */
function validateIntuneAppCreation(response: any): response is IntuneAppResponse {
    if (!response) return false;
    
    // Check for required properties
    const requiredProps = ['Id', 'DisplayName', 'Publisher', 'CreatedDateTime', 'LastModifiedDateTime', 'Version'];
    return requiredProps.every(prop => prop in response);
}

/**
 * Deploys multiple applications to Intune
 * @param apps Array of apps to deploy
 * @param onProgress Optional callback to track deployment progress
 * @returns Promise with deployment results
 */
export async function deployAppsToIntune(
    apps: StagedAppDeploymentInfo[],
    onProgress?: (progress: DeploymentProgress) => void
): Promise<DeploymentResult[]> {
    // Filter for locked apps only
    const appsToDeploy = apps.filter(app => app.isLocked);
    
    if (appsToDeploy.length === 0) {
        throw new Error('No locked apps to deploy');
    }

    const results: DeploymentResult[] = [];
    const progress: DeploymentProgress = {
        total: appsToDeploy.length,
        completed: 0,
        results: []
    };

    for (const app of appsToDeploy) {
        try {
            progress.currentApp = app.displayName;
            if (onProgress) onProgress(progress);

            const parametersForScript = {
                DisplayName: app.displayName,
                Description: app.description || '',
                Publisher: app.publisher || '',
                InstallExperience: app.installExperience,
                RestartBehavior: app.restartBehavior,
                InstallCommandLine: app.installCommandLine || '',
                UninstallCommandLine: app.uninstallCommandLine || '',
                // Note: DetectionRule and RequirementRule will need to be handled separately
                // as they require specific PowerShell object creation
            };

            const result = await authService.executeCommand(
                "Add-App-to-Intune.ps1",
                parametersForScript,
                true // Parse output as JSON
            );

            // Validate the response
            if (!result.success || !result.output) {
                throw new Error('Failed to create app in Intune: No output received');
            }

            const parsedOutput = typeof result.output === 'string' ? JSON.parse(result.output) : result.output;
            
            if (!validateIntuneAppCreation(parsedOutput)) {
                throw new Error('Invalid response from Intune: Missing required properties');
            }

            const deploymentResult: DeploymentResult = {
                success: true,
                appId: app.id,
                intuneAppId: parsedOutput.Id,
                output: parsedOutput,
                error: undefined
            };

            results.push(deploymentResult);
            progress.completed++;
            progress.results = results;
            if (onProgress) onProgress(progress);

        } catch (error) {
            const errorResult: DeploymentResult = {
                success: false,
                appId: app.id,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
            results.push(errorResult);
            progress.completed++;
            progress.results = results;
            if (onProgress) onProgress(progress);
        }
    }

    return results;
}