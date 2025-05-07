/**
 * Home page component for the Intune Deployment App
 *
 * This is the main entry point for the application that users see when they
 * visit the root URL. It renders the dashboard within the dashboard layout.
 */
import Dashboard from "@/components/dashboard"
import { DashboardLayout } from "@/components/dashboard-layout"

/**
 * Home page component that displays the main dashboard
 *
 * @returns The dashboard wrapped in the dashboard layout
 */
export default function Home() {
  return (
    <DashboardLayout>
      <Dashboard />
    </DashboardLayout>
  )
}
