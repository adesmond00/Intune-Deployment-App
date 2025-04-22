/**
 * Winget Deployment page component for the Intune Deployment App
 *
 * This page provides the interface for searching, selecting, configuring,
 * and deploying applications using the Windows Package Manager (winget).
 */
import { WingetDeploymentPage } from "@/components/winget-deployment-page"
import { DashboardLayout } from "@/components/dashboard-layout"

/**
 * Winget Deployment page component
 *
 * @returns The Winget deployment interface wrapped in the dashboard layout
 */
export default function WingetDeployment() {
  return (
    <DashboardLayout>
      <WingetDeploymentPage />
    </DashboardLayout>
  )
}
