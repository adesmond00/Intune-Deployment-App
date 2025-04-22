/**
 * Sidebar component for the Intune Deployment App
 *
 * This component renders the collapsible sidebar navigation that appears on all pages.
 * It includes the app logo, main navigation links, and submenus for deployment options.
 * The sidebar can be collapsed to save space on smaller screens.
 */
"use client"

import type React from "react"

import { ChevronLeft, ChevronRight, Home, Package, Terminal } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Sidebar component with collapsible navigation
 *
 * @returns The application sidebar with navigation links
 */
export function Sidebar() {
  // State to track if the sidebar is collapsed
  const [collapsed, setCollapsed] = useState(false)

  // State to track which submenus are open
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({
    deployments: true, // Open by default
  })

  /**
   * Toggle a submenu's open/closed state
   *
   * @param key - The identifier for the submenu to toggle
   */
  const toggleSubmenu = (key: string) => {
    setOpenSubmenus((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  return (
    <div
      className={cn(
        "flex h-screen flex-col border-r bg-muted/10 transition-all duration-300",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* App logo and title */}
      <div className="flex h-16 items-center border-b px-4">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Package className="h-6 w-6" />
            <span>Intune Deploy</span>
          </Link>
        )}
        {collapsed && (
          <Link href="/" className="flex w-full items-center justify-center">
            <Package className="h-6 w-6" />
          </Link>
        )}
      </div>

      {/* Navigation links */}
      <div className="flex-1 overflow-auto py-2">
        <nav className="grid items-start px-2 text-sm font-medium">
          {/* Dashboard link */}
          <NavItem href="/" icon={Home} label="Home" collapsed={collapsed} />

          {/* Direct link to Winget deployment */}
          <NavItem href="/deployments/winget" icon={Terminal} label="Winget Deployment" collapsed={collapsed} />
        </nav>
      </div>

      {/* Collapse/expand button */}
      <div className="border-t p-2">
        <Button variant="outline" size="sm" className="w-full justify-center" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}

/**
 * Interface for navigation item props
 */
interface NavItemProps {
  href: string // URL the item links to
  icon: React.ElementType // Icon component to display
  label: string // Text label for the item
  collapsed: boolean // Whether the sidebar is collapsed
}

/**
 * Simple navigation item component
 *
 * @param href - URL the item links to
 * @param icon - Icon component to display
 * @param label - Text label for the item
 * @param collapsed - Whether the sidebar is collapsed
 * @returns A navigation link with icon and optional label
 */
function NavItem({ href, icon: Icon, label, collapsed }: NavItemProps) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href)

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:bg-muted/50",
        isActive ? "bg-muted/50 text-primary font-medium" : "text-muted-foreground",
        collapsed ? "justify-center" : "",
      )}
    >
      <Icon className="h-4 w-4" />
      {!collapsed && <span>{label}</span>}
    </Link>
  )
}
