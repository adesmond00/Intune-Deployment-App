/**
 * Shared TypeScript interfaces for the Intune Deployment Toolkit Frontend.
 */

/**
 * Base interface for Win32 Lob App Rules (matching Graph API structure).
 */
export interface Win32LobAppRule {
  '@odata.type': string;
  [key: string]: any; // Allow other properties
}

/**
 * Interface for Requirement Rules.
 */
export interface RequirementRule extends Win32LobAppRule {
  '@odata.type': '#microsoft.graph.win32LobAppRequirement';
  operator: 'greaterOrEqual' | 'equal' | 'lessOrEqual' | 'less' | 'greater' | 'notEqual';
  detectionType: 'version' | 'architecture' | 'diskSpace' | 'ram';
  value: string;
}

/**
 * Interface representing the structured information needed for a staged deployment.
 * This holds data gathered initially and potentially edited by the user before deployment.
 */
export interface StagedAppDeploymentInfo {
  displayName: string;
  id: string;
  version: string;
  publisher: string | null;
  description: string | null;
  installCommandLine: string | null;
  uninstallCommandLine: string | null;
  installExperience: 'system' | 'user';
  restartBehavior: 'suppress' | 'force' | 'basedOnReturnCode';
  isLocked: boolean;

  // Configuration fields managed in DeploymentConfigModal
  detectionScript?: string;
  runAs32Bit?: boolean;
  requirementRules?: RequirementRule[];
  showAdvancedSettings?: boolean;

  // Deprecated/Placeholder fields (kept for reference, consider removing if unused)
  detectionRuleNotes?: string | null;
  requirementRuleNotes?: string | null;
}

/**
 * Default Requirement Rules for new apps.
 */
export const defaultRequirementRules: RequirementRule[] = [
  {
    '@odata.type': '#microsoft.graph.win32LobAppRequirement',
    operator: 'greaterOrEqual',
    detectionType: 'version',
    value: '10.0.10240', // Windows 10 RTM
  },
  {
    '@odata.type': '#microsoft.graph.win32LobAppRequirement',
    operator: 'equal',
    detectionType: 'architecture',
    value: 'x64', // Default to x64
  },
];
