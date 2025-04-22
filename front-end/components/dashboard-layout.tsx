/**
 * Dashboard Layout component for the Intune Deployment App
 *
 * This component provides the consistent layout structure used across all pages
 * in the application. It includes the sidebar navigation, header, and main content area.
 */
import type React from "react"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"

/**
 * DashboardLayout component that structures the application interface
 *
 * @param children - The page content to be rendered in the main area
 * @returns A structured layout with sidebar, header, and content area
 */
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar navigation */}
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top header with search, notifications, and user menu */}
        <Header />
        {/* Main content area with scrollable content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-muted/20">{children}</main>
      </div>
    </div>
  )
}
