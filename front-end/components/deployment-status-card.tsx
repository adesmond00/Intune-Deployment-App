/**
 * DeploymentStatusCard component for the Intune Deployment App
 *
 * This component displays the deployment status across different platforms
 * using progress bars to visualize completion percentages.
 */
"use client"

import { Progress } from "@/components/ui/progress"

/**
 * DeploymentStatusCard component showing deployment progress by platform
 *
 * @returns A card with progress bars for each platform's deployment status
 */
export function DeploymentStatusCard() {
  // Placeholder data for deployment status across different platforms
  // In a real application, this would come from an API or state management
  const deploymentStatus = [
    { name: "Windows 11", progress: 85, color: "bg-green-500" },
    { name: "Windows 10", progress: 65, color: "bg-blue-500" },
    { name: "macOS", progress: 40, color: "bg-orange-500" },
    { name: "iOS", progress: 75, color: "bg-purple-500" },
    { name: "Android", progress: 60, color: "bg-pink-500" },
  ]

  return (
    <div className="space-y-8">
      {deploymentStatus.map((status) => (
        <div key={status.name} className="space-y-2">
          {/* Platform name and percentage display */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Colored dot indicator matching the progress bar color */}
              <div className={`h-3 w-3 rounded-full ${status.color}`}></div>
              <span className="text-sm font-medium">{status.name}</span>
            </div>
            {/* Percentage display */}
            <span className="text-sm text-muted-foreground">{status.progress}%</span>
          </div>
          {/* Progress bar visualization */}
          <Progress value={status.progress} className="h-2" />
        </div>
      ))}
    </div>
  )
}
