/**
 * Header component for the Intune Deployment App
 *
 * This component renders the top navigation bar that appears on all pages.
 * It includes the app title, search functionality, and various action buttons
 * for notifications, help, settings, and user profile.
 */
"use client"

import { Bell, HelpCircle, Settings } from "lucide-react"
import { useTheme } from "next-themes"
import { useState, useEffect } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * Header component with navigation and action buttons
 *
 * @returns The application header with search and user controls
 */
export function Header() {
  // Access the theme context to enable theme switching
  const { setTheme } = useTheme()
  
  // State to track if running in Electron
  const [isElectron, setIsElectron] = useState(false)
  
  // Check if running in Electron
  useEffect(() => {
    // Check if window.electronAPI exists
    if (typeof window !== 'undefined' && window.electronAPI) {
      setIsElectron(true)
    }
  }, [])
  
  // Handle logout
  const handleLogout = async () => {
    if (isElectron && window.electronAPI) {
      try {
        console.log("Logging out...")
        const result = await window.electronAPI.logout()
        console.log("Logout result:", result)
        // Redirect logic happens automatically through the main process
        // which will send a show-login event
      } catch (error) {
        console.error("Error during logout:", error)
        // Handle error if needed
      }
    } else {
      console.warn("Logout attempted outside Electron environment")
      // Fallback for non-Electron environment if needed
    }
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
      {/* App title - hidden on mobile */}
      <div className="hidden md:block">
        <h1 className="text-xl font-semibold">Intune Deployment App</h1>
      </div>

      {/* Action buttons and user menu */}
      <div className="ml-auto flex items-center gap-2">
        {/* Notifications dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="rounded-full">
              <Bell className="h-4 w-4" />
              <span className="sr-only">Notifications</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>No new notifications</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Help dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="rounded-full">
              <HelpCircle className="h-4 w-4" />
              <span className="sr-only">Help</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Help</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Documentation</DropdownMenuItem>
            <DropdownMenuItem>Support</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Settings and theme dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="rounded-full">
              <Settings className="h-4 w-4" />
              <span className="sr-only">Settings</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="rounded-full">
              <img
                src="/placeholder.svg?height=32&width=32"
                alt="User"
                className="rounded-full"
                height={32}
                width={32}
              />
              <span className="sr-only">User menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
