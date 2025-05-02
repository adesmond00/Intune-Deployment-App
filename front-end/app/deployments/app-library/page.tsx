/**
 * App Library Deployment page component for the Intune Deployment App
 *
 * This page provides the interface for searching, selecting, configuring,
 * and deploying applications from the organization's internal app library.
 */
import { AppLibraryDeploymentPage } from "@/components/app-library-deployment-page"
import { DashboardLayout } from "@/components/dashboard-layout"

/**
 * App Library Deployment page component
 *
 * @returns The App Library deployment interface wrapped in the dashboard layout
 */
export default function AppLibraryDeployment() {
  return (
    <DashboardLayout>
      <AppLibraryDeploymentPage />
    </DashboardLayout>
  )
}
