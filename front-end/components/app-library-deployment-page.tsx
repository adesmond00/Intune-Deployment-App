/**
 * AppLibraryDeploymentPage component for the Intune Deployment App
 *
 * This component provides the interface for searching, selecting, configuring,
 * and deploying applications from the organization's internal app library.
 * It supports bulk application selection and deployment to Intune.
 */
"use client"

import {
  Check,
  Lock,
  Plus,
  Search,
  Package,
  Trash2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  History,
  RefreshCw,
} from "lucide-react"
import { useState, useEffect } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useTheme } from "next-themes"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AddAppDialog } from "@/components/add-app-dialog"
import { AddVersionDialog } from "@/components/add-version-dialog"
import { toast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"
import { DeleteAppDialog } from "@/components/delete-app-dialog"
import { DeleteVersionDialog } from "@/components/delete-version-dialog"
import { RecentlyDeleted } from "@/components/recently-deleted"
// Add these imports at the top of the file
import { EditAppDialog } from "@/components/edit-app-dialog"
import { EditVersionDialog } from "@/components/edit-version-dialog"

/**
 * API Base URL for all endpoints
 * This can be easily modified to point to different environments
 */
const API_BASE_URL = "http://127.0.0.1:8000"

/**
 * Interface defining an App Library application
 */
interface AppLibraryApp {
  id: string // Unique identifier for the app in the library
  app_id: string // Custom ID like "APP001"
  name: string // Display name of the application
  publisher: string // Publisher/developer of the application
  version: string // Current version of the application
  description: string | null // Brief description of the application
  category?: string | null // Optional category for the application
  lastUpdated?: string // Optional date when the app was last updated
}

/**
 * Interface for a specific version of an application
 */
interface AppVersion {
  id: string // Unique identifier for this specific version
  version_id: string // Custom ID like "APP001-1.0.0"
  version: string // Version number
  lastUpdated: string // Date when this version was added/updated
  release_notes?: string | null // Optional release notes
  detection_script?: string | null // Optional detection script
  install_command?: string | null // Optional install command
  uninstall_command?: string | null // Optional uninstall command
  path: string; // Path to the .intunewin file in Backblaze from Supabase
}

/**
 * Interface extending AppLibraryApp with deployment configuration
 */
interface SelectedApp extends AppLibraryApp {
  isLocked: boolean // Whether the configuration is locked/confirmed
  deploymentStatus?: "pending" | "deploying" | "success" | "failed" // Status of deployment
  appId?: string // ID returned from the API after successful deployment
  errorMessage?: string // Error message if deployment failed
  version_id?: string // The version_id for the selected version
  detection_script?: string | null // Detection script for the selected version
  install_command?: string | null // Install command for the selected version
  uninstall_command?: string | null // Uninstall command for the selected version
  path: string; // Path to the .intunewin file in Backblaze for this version
}

/**
 * Interface for the App Library API request payload
 */
interface AppLibraryUploadRequest {
  backblaze_path: string // Path to the .intunewin file in Backblaze
  display_name: string // Friendly name to show in Intune
  package_id: string // App library package identifier
  publisher?: string // Publisher name (optional)
  description?: string // Description text (optional)
  detection_script?: string // PowerShell detection script (optional)
  install_command?: string // Install command (optional)
  uninstall_command?: string // Uninstall command (optional)
}

/**
 * Interface for the API response
 */
interface UploadResponse {
  app_id: string // ID of the deployed application
}

/**
 * Fetches version history for an application
 *
 * @param app - The application to fetch versions for
 */
const fetchAppVersions = async (app: AppLibraryApp) => {
  try {
    const { data, error } = await supabase
      .from("app_versions")
      .select("*")
      .eq("app_id", app.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    if (error) throw error

    // Transform the data to match our interface
    const versions: AppVersion[] = data.map((version: any) => ({
      id: version.id,
      version_id: version.version_id,
      version: version.version,
      lastUpdated: version.updated_at,
      release_notes: version.release_notes,
      detection_script: version.detection_script,
      install_command: version.install_command,
      uninstall_command: version.uninstall_command,
      path: version.path, // Map path from Supabase data
    }))

    return versions
  } catch (error) {
    console.error("Error fetching versions:", error)
    toast({
      title: "Error",
      description: "Failed to fetch version history",
      variant: "destructive",
    })
    return []
  }
}

/**
 * AppLibraryDeploymentPage component for bulk application deployment
 *
 * @returns An interface for searching, selecting, configuring, and deploying App Library applications
 */
export function AppLibraryDeploymentPage() {
  // Access theme context
  const { resolvedTheme } = useTheme()
  const isDarkTheme = resolvedTheme === "dark"

  // State for search functionality
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<AppLibraryApp[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // State for selected applications
  const [selectedApps, setSelectedApps] = useState<SelectedApp[]>([])

  // State for deployment process
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploymentProgress, setDeploymentProgress] = useState(0)
  const [currentDeployingApp, setCurrentDeployingApp] = useState<string | null>(null)
  const [deploymentError, setDeploymentError] = useState<string | null>(null)

  // State for copy button
  const [copiedScriptId, setCopiedScriptId] = useState<string | null>(null)

  // State for version history modal
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false)
  const [currentAppVersions, setCurrentAppVersions] = useState<{ app: AppLibraryApp; versions: AppVersion[] } | null>(
    null,
  )

  // Add this state variable at the top of the component
  const [showRecentlyDeleted, setShowRecentlyDeleted] = useState(false)

  // Load apps on initial render
  useEffect(() => {
    fetchApps()
  }, [])

  // Reset copy status after 2 seconds
  useEffect(() => {
    if (copiedScriptId) {
      const timer = setTimeout(() => {
        setCopiedScriptId(null)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [copiedScriptId])

  /**
   * Fetches all apps from the database
   */
  const fetchApps = async () => {
    setIsLoading(true)
    setSearchError(null)

    try {
      const response = await fetch("/api/app-library/apps")

      if (!response.ok) {
        throw new Error("Failed to fetch apps")
      }

      const apps = await response.json()

      // Transform the data to match our interface
      const transformedApps: AppLibraryApp[] = apps.map((app: any) => ({
        id: app.id,
        app_id: app.app_id,
        name: app.name,
        publisher: app.publisher,
        description: app.description,
        category: app.category,
        version: "Loading...", // Will be updated with current version
        lastUpdated: app.updated_at,
      }))

      setSearchResults(transformedApps)

      // Fetch current versions for each app
      for (const app of transformedApps) {
        fetchCurrentVersion(app)
      }
    } catch (error) {
      console.error("Error fetching apps:", error)
      setSearchError(error instanceof Error ? error.message : "Failed to fetch applications")
      setSearchResults([])
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Fetches the current version for an app
   */
  const fetchCurrentVersion = async (app: AppLibraryApp) => {
    try {
      const { data, error } = await supabase
        .from("app_versions")
        .select("*")
        .eq("app_id", app.id)
        .eq("is_current", true)
        .is("deleted_at", null)
        .single()

      if (error) throw error

      if (data) {
        // Update the app in search results with its current version
        setSearchResults((prev) => prev.map((a) => (a.id === app.id ? { ...a, version: data.version } : a)))
      }
    } catch (error) {
      console.error(`Error fetching current version for ${app.name}:`, error)
    }
  }

  /**
   * Fetches search results based on query
   *
   * @param query - The search term to query
   */
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      return
    }

    setIsSearching(true)
    setSearchError(null)

    try {
      const response = await fetch("/api/app-library/apps")

      if (!response.ok) {
        throw new Error("Failed to fetch apps")
      }

      const apps = await response.json()

      // Filter results based on search query (case-insensitive)
      const lowercaseQuery = searchQuery.toLowerCase()
      const filteredApps = apps.filter(
        (app: any) =>
          app.name.toLowerCase().includes(lowercaseQuery) ||
          app.app_id.toLowerCase().includes(lowercaseQuery) ||
          (app.category && app.category.toLowerCase().includes(lowercaseQuery)) ||
          app.publisher.toLowerCase().includes(lowercaseQuery) ||
          (app.description && app.description.toLowerCase().includes(lowercaseQuery)),
      )

      // Transform the data to match our interface
      const transformedApps: AppLibraryApp[] = filteredApps.map((app: any) => ({
        id: app.id,
        app_id: app.app_id,
        name: app.name,
        publisher: app.publisher,
        description: app.description,
        category: app.category,
        version: "Loading...", // Will be updated with current version
        lastUpdated: app.updated_at,
      }))

      setSearchResults(transformedApps)

      // Fetch current versions for each app
      for (const app of transformedApps) {
        fetchCurrentVersion(app)
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Failed to search for applications")
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  /**
   * Opens the version history modal for an application
   *
   * @param app - The application to show version history for
   */
  const showVersionHistory = async (app: AppLibraryApp) => {
    try {
      const versions = await fetchAppVersions(app)
      setCurrentAppVersions({ app, versions })
      setVersionHistoryOpen(true)
    } catch (error) {
      console.error("Error fetching version history:", error)
    }
  }

  /**
   * Adds a specific version of an application to the selected list
   *
   * @param app - The base application
   * @param version - The specific version to add
   */
  const addAppVersion = (app: AppLibraryApp, version: AppVersion) => {
    // Only add if not already in the list
    if (!selectedApps.some((selectedApp) => selectedApp.version_id === version.version_id)) {
      setSelectedApps([
        ...selectedApps,
        {
          ...app,
          version: version.version,
          version_id: version.version_id,
          detection_script: version.detection_script,
          install_command: version.install_command,
          uninstall_command: version.uninstall_command,
          path: version.path, // Copy path from AppVersion to SelectedApp
          isLocked: false,
        },
      ])

      // Close the modal after adding
      setVersionHistoryOpen(false)
    }
  }

  /**
   * Adds an application to the selected list
   *
   * @param app - The App Library application to add
   */
  const addApp = (app: AppLibraryApp) => {
    // Only add if not already in the list
    if (!selectedApps.some((selectedApp) => selectedApp.app_id === app.app_id)) {
      setSelectedApps([
        ...selectedApps,
        {
          ...app,
          isLocked: false,
        },
      ])
    }
  }

  /**
   * Removes an application from the selected list
   *
   * @param appId - The ID of the application to remove
   */
  const removeApp = (appId: string) => {
    setSelectedApps(selectedApps.filter((app) => app.id !== appId))
  }

  /**
   * Toggles the locked state of an application
   * Locked applications cannot be edited or removed
   *
   * @param appId - The ID of the application to toggle
   */
  const toggleLockApp = (appId: string) => {
    setSelectedApps(
      selectedApps.map((app) => {
        if (app.id === appId) {
          return {
            ...app,
            isLocked: !app.isLocked,
          }
        }
        return app
      }),
    )
  }

  /**
   * Deploys a single application to Intune via API
   *
   * @param app - The application to deploy
   * @returns Promise resolving to the app with updated deployment status
   */
  const deployApp = async (app: SelectedApp): Promise<SelectedApp> => {
    try {
      // Update current deploying app
      setCurrentDeployingApp(app.name)

      // Prepare request payload for App Library
      // IMPORTANT: app.path (formerly app.backblaze_file_path) needs to be populated correctly.
      // This path should point to the specific .intunewin file identifier in Backblaze for the app.version.
      if (!app.path) {
        throw new Error(`File path (Backblaze identifier) is missing for app: ${app.name} version: ${app.version}`);
      }
      const payload: AppLibraryUploadRequest = {
        backblaze_path: app.path, // Use app.path here
        display_name: app.name,
        package_id: app.app_id, // This is the App Library's unique ID (e.g., APP001)
        publisher: app.publisher,
        description: app.description || "",
        detection_script: app.detection_script || undefined,
        install_command: app.install_command || undefined,
        uninstall_command: app.uninstall_command || undefined,
      }

      // Make API request to the new App Library endpoint
      const response = await fetch(`${API_BASE_URL}/app-library/deploy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      // Handle response
      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(errorData || "Failed to deploy application")
      }

      const data: UploadResponse = await response.json()

      // Record the deployment in the database
      if (app.version_id) {
        const { data: versionData } = await supabase
          .from("app_versions")
          .select("id")
          .eq("version_id", app.version_id)
          .single()

        if (versionData) {
          await supabase.from("deployments").insert({
            app_version_id: versionData.id,
            status: "success",
            intune_app_id: data.app_id,
          })
        }
      }

      // Return updated app with success status
      return {
        ...app,
        deploymentStatus: "success",
        appId: data.app_id,
      }
    } catch (error) {
      // Record the failed deployment in the database
      if (app.version_id) {
        const { data: versionData } = await supabase
          .from("app_versions")
          .select("id")
          .eq("version_id", app.version_id)
          .single()

        if (versionData) {
          await supabase.from("deployments").insert({
            app_version_id: versionData.id,
            status: "failed",
            error_message: error instanceof Error ? error.message : "Unknown error",
          })
        }
      }

      // Return updated app with failure status
      return {
        ...app,
        deploymentStatus: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error occurred",
      }
    }
  }

  /**
   * Deploys all locked applications to Intune sequentially
   */
  const deployApps = async () => {
    const appsToDeployCount = selectedApps.filter((app) => app.isLocked).length
    if (appsToDeployCount === 0) {
      toast({
        title: "No apps selected",
        description: "Please configure and lock at least one application for deployment.",
        variant: "destructive",
      })
      return
    }

    // Reset deployment state
    setIsDeploying(true)
    setDeploymentProgress(0)
    setCurrentDeployingApp(null)
    setDeploymentError(null)

    // Mark all locked apps as pending deployment
    setSelectedApps(selectedApps.map((app) => (app.isLocked ? { ...app, deploymentStatus: "pending" } : app)))

    // Get all locked apps
    const appsToDeployList = selectedApps.filter((app) => app.isLocked)
    let completedCount = 0
    let updatedApps = [...selectedApps]

    // Deploy apps one by one
    for (const app of appsToDeployList) {
      try {
        // Update app status to deploying
        updatedApps = updatedApps.map((a) => (a.id === app.id ? { ...a, deploymentStatus: "deploying" } : a))
        setSelectedApps(updatedApps)

        // Deploy the app
        const deployedApp = await deployApp(app)

        // Update the app in the list with deployment result
        updatedApps = updatedApps.map((a) => (a.id === deployedApp.id ? deployedApp : a))
        setSelectedApps(updatedApps)

        // Update progress
        completedCount++
        setDeploymentProgress(Math.round((completedCount / appsToDeployList.length) * 100))
      } catch (error) {
        // Handle unexpected errors
        setDeploymentError(`Failed to deploy ${app.name}: ${error instanceof Error ? error.message : "Unknown error"}`)

        // Update app status to failed
        updatedApps = updatedApps.map((a) =>
          a.id === app.id ? { ...a, deploymentStatus: "failed", errorMessage: "Deployment process failed" } : a,
        )
        setSelectedApps(updatedApps)

        // Update progress
        completedCount++
        setDeploymentProgress(Math.round((completedCount / appsToDeployList.length) * 100))
      }
    }

    // Deployment process completed
    setIsDeploying(false)
    setCurrentDeployingApp(null)
  }

  /**
   * Calculates deployment statistics
   */
  const getDeploymentStats = () => {
    const lockedApps = selectedApps.filter((app) => app.isLocked)
    const successful = lockedApps.filter((app) => app.deploymentStatus === "success").length
    const failed = lockedApps.filter((app) => app.deploymentStatus === "failed").length
    const pending = lockedApps.filter(
      (app) => app.deploymentStatus === "pending" || app.deploymentStatus === "deploying",
    ).length

    return { total: lockedApps.length, successful, failed, pending }
  }

  // Get deployment statistics
  const deploymentStats = getDeploymentStats()

  // Then update the return statement to include a toggle button and conditionally render the RecentlyDeleted component
  return (
    <div className="flex flex-col gap-6">
      {/* Page header with title and deploy button */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Deploy from App Library</h2>
        <div className="flex gap-2">
          <Button
            onClick={deployApps}
            disabled={!selectedApps.some((app) => app.isLocked) || isDeploying}
            className="flex items-center gap-2"
          >
            <Package className="h-4 w-4" />
            {isDeploying ? "Deploying..." : "Deploy to Intune"}
          </Button>
        </div>
      </div>

      {/* Deployment Progress Section */}
      {isDeploying && (
        <Card>
          <CardHeader>
            <CardTitle>Deployment Progress</CardTitle>
            <CardDescription>
              Deploying applications to Intune ({deploymentStats.successful} of {deploymentStats.total} completed)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={deploymentProgress} className="h-2" />

            {currentDeployingApp && (
              <div className="flex items-center gap-2 text-sm">
                <span className="animate-pulse">●</span>
                <span>
                  Currently deploying: <strong>{currentDeployingApp}</strong>
                </span>
              </div>
            )}

            {deploymentError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{deploymentError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Deployment Results Section - shown after deployment */}
      {!isDeploying && (deploymentStats.successful > 0 || deploymentStats.failed > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Deployment Results</CardTitle>
            <CardDescription>
              {deploymentStats.successful} successful, {deploymentStats.failed} failed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {selectedApps
                .filter((app) => app.deploymentStatus === "success" || app.deploymentStatus === "failed")
                .map((app) => (
                  <div key={`result-${app.id}`} className="flex items-start gap-3 p-3 rounded-md border">
                    {app.deploymentStatus === "success" ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium">{app.name}</h4>
                      <p className="text-sm text-muted-foreground">{app.app_id}</p>
                      {app.deploymentStatus === "success" && app.appId && (
                        <p className="text-xs mt-1">
                          App ID: <code className="bg-muted px-1 py-0.5 rounded">{app.appId}</code>
                        </p>
                      )}
                      {app.deploymentStatus === "failed" && app.errorMessage && (
                        <p className="text-xs text-red-500 mt-1">{app.errorMessage}</p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>App Library</CardTitle>
            <CardDescription>Search and manage applications in your organization's app library</CardDescription>
          </div>
          <AddAppDialog onAppAdded={fetchApps} />
        </CardHeader>
        <CardContent>
          {/* Search input and button */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by name, ID, publisher, or category"
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch()
                  }
                }}
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? "Searching..." : "Search"}
            </Button>
            <Button variant="outline" onClick={fetchApps} disabled={isLoading} className="gap-1">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>

          {/* Search Error */}
          {searchError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Search Error</AlertTitle>
              <AlertDescription>{searchError}</AlertDescription>
            </Alert>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {/* Search Results */}
          {!isLoading && searchResults.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 font-medium">Applications ({searchResults.length})</h3>
              <ScrollArea className="h-[300px] rounded-md border">
                <div className="p-4">
                  {searchResults.map((app) => (
                    <div key={app.id} className="mb-4 flex items-start justify-between rounded-lg border p-3 last:mb-0">
                      {/* App information */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium">{app.name}</h4>
                          <Badge
                            variant="outline"
                            className="text-xs cursor-pointer hover:bg-muted"
                            onClick={() => showVersionHistory(app)}
                          >
                            <span className="flex items-center gap-1">
                              {app.version}
                              <History className="h-3 w-3 ml-1" />
                            </span>
                          </Badge>
                          {app.category && (
                            <Badge variant="secondary" className="text-xs">
                              {app.category}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{app.description}</p>
                        <div className="mt-1 flex items-center gap-4">
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">ID:</span> {app.app_id}
                          </p>
                          {app.lastUpdated && (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium">Updated:</span>{" "}
                              {new Date(app.lastUpdated).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Action buttons */}
                      <div className="flex items-center gap-1">
                        {/* Edit button */}
                        <EditAppDialog app={app} onAppUpdated={fetchApps} />
                        {/* Add delete button here */}
                        <DeleteAppDialog appId={app.app_id} appName={app.name} onAppDeleted={fetchApps} />
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-1 flex items-center gap-1"
                          onClick={() => addApp(app)}
                          disabled={selectedApps.some((selectedApp) => selectedApp.app_id === app.app_id)}
                        >
                          {selectedApps.some((selectedApp) => selectedApp.app_id === app.app_id) ? (
                            <>
                              <Check className="h-3 w-3" /> Added
                            </>
                          ) : (
                            <>
                              <Plus className="h-3 w-3" /> Add
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* No results message */}
          {!isLoading && searchResults.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No applications found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Version History Modal */}
      <Dialog open={versionHistoryOpen} onOpenChange={setVersionHistoryOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
            <DialogDescription>{currentAppVersions?.app.name} - Select a version to deploy</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {currentAppVersions && (
              <div className="flex justify-end mb-2">
                <AddVersionDialog
                  appId={currentAppVersions.app.app_id}
                  appName={currentAppVersions.app.name}
                  currentVersion={currentAppVersions.app.version}
                  onVersionAdded={() => {
                    // Refresh versions
                    fetchAppVersions(currentAppVersions.app).then((versions) => {
                      setCurrentAppVersions({ ...currentAppVersions, versions })
                    })
                    // Refresh app list to update current version
                    fetchApps()
                  }}
                />
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Version ID</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Release Notes</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentAppVersions?.versions.map((version) => (
                  <TableRow key={version.id}>
                    <TableCell className="font-medium">{version.version}</TableCell>
                    <TableCell>{version.version_id}</TableCell>
                    <TableCell>{new Date(version.lastUpdated).toLocaleString()}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {version.release_notes || "No release notes"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {/* Edit button */}
                        <EditVersionDialog
                          appId={currentAppVersions.app.app_id}
                          appName={currentAppVersions.app.name}
                          versionId={version.version_id}
                          version={version}
                          onVersionUpdated={() => {
                            // Refresh versions
                            fetchAppVersions(currentAppVersions.app).then((versions) => {
                              setCurrentAppVersions({ ...currentAppVersions, versions })
                            })
                            // Refresh app list to update current version
                            fetchApps()
                          }}
                        />
                        <DeleteVersionDialog
                          versionId={version.version_id}
                          appName={currentAppVersions.app.name}
                          version={version.version}
                          onVersionDeleted={() => {
                            // Refresh versions
                            fetchAppVersions(currentAppVersions.app).then((versions) => {
                              setCurrentAppVersions({ ...currentAppVersions, versions })
                            })
                            // Refresh app list to update current version
                            fetchApps()
                          }}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addAppVersion(currentAppVersions.app, version)}
                          disabled={selectedApps.some((app) => app.version_id === version.version_id)}
                        >
                          {selectedApps.some((app) => app.version_id === version.version_id) ? (
                            <>
                              <Check className="h-3 w-3 mr-1" /> Added
                            </>
                          ) : (
                            <>
                              <Plus className="h-3 w-3 mr-1" /> Add
                            </>
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogClose asChild>
            <Button variant="outline" className="w-full">
              Close
            </Button>
          </DialogClose>
        </DialogContent>
      </Dialog>

      {/* Selected Apps Section */}
      {selectedApps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Selected Applications ({selectedApps.length})</CardTitle>
            <CardDescription>Review and deploy applications from your library</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {selectedApps.map((app) => (
                <div key={app.id} className="rounded-lg border overflow-hidden">
                  {/* App Header - always visible */}
                  <div className="flex items-center justify-between p-4">
                    <div className="flex flex-1 items-center gap-2">
                      {/* Icon changes based on locked state and deployment status */}
                      {app.deploymentStatus === "success" ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : app.deploymentStatus === "failed" ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : app.isLocked ? (
                        <Lock className="h-4 w-4 text-green-500" />
                      ) : (
                        <Package className="h-4 w-4" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{app.name}</h4>
                          <Badge variant="outline" className="text-xs">
                            {app.version}
                          </Badge>
                          {/* Status badges */}
                          {app.deploymentStatus === "success" && (
                            <Badge variant="default" className="bg-green-500 text-xs">
                              Deployed
                            </Badge>
                          )}
                          {app.deploymentStatus === "failed" && (
                            <Badge variant="default" className="bg-red-500 text-xs">
                              Failed
                            </Badge>
                          )}
                          {app.deploymentStatus === "deploying" && (
                            <Badge variant="default" className="bg-blue-500 text-xs">
                              Deploying...
                            </Badge>
                          )}
                          {app.isLocked && !app.deploymentStatus && (
                            <Badge variant="default" className="bg-green-500 text-xs">
                              Ready to Deploy
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                          <span>ID: {app.app_id}</span>
                          <span>•</span>
                          <span>Publisher: {app.publisher}</span>
                        </div>
                        {app.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{app.description}</p>
                        )}
                      </div>
                    </div>
                    {/* Action buttons - only shown if not currently deploying */}
                    {!isDeploying && (
                      <div className="flex items-center gap-2">
                        {/* Remove button - only visible when not locked */}
                        {!app.isLocked && !app.deploymentStatus && (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => removeApp(app.id)}>
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Remove</span>
                          </Button>
                        )}
                        {/* Lock/Unlock button - only visible when not deployed */}
                        {!app.deploymentStatus && (
                          <Button
                            size="sm"
                            variant={app.isLocked ? "outline" : "default"}
                            className="h-8 px-2"
                            onClick={() => toggleLockApp(app.id)}
                          >
                            {app.isLocked ? "Unlock" : "Lock"}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={deployApps}
              disabled={!selectedApps.some((app) => app.isLocked && !app.deploymentStatus) || isDeploying}
              className="w-full"
            >
              {isDeploying
                ? `Deploying... (${deploymentStats.successful}/${deploymentStats.total})`
                : `Deploy ${selectedApps.filter((app) => app.isLocked && !app.deploymentStatus).length} Applications to Intune`}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Toggle button for Recently Deleted section */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setShowRecentlyDeleted(!showRecentlyDeleted)} className="gap-1">
          {showRecentlyDeleted ? "Hide" : "Show"} Recently Deleted
        </Button>
      </div>

      {/* Recently Deleted section */}
      {showRecentlyDeleted && <RecentlyDeleted onRefresh={fetchApps} />}
    </div>
  )
}
