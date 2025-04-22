/**
 * WingetDeploymentPage component for the Intune Deployment App
 *
 * This component provides the interface for searching, selecting, configuring,
 * and deploying applications using the Windows Package Manager (winget).
 * It supports bulk application selection and deployment to Intune.
 */
"use client"

import {
  Check,
  ChevronDown,
  ChevronUp,
  Lock,
  Plus,
  Search,
  Terminal,
  Trash2,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react"
import { useState, useEffect } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

/**
 * Path on the API host to the generic .intunewin package that triggers the
 * Winget install/uninstall PowerShell script.
 */
const INTUNEWIN_PATH = "files/Winget-InstallPackage.intunewin"; // <── changed

/**
 * Interface defining a Winget application
 */
interface WingetApp {
  id: string // Unique identifier for the app in the Winget repository
  name: string // Display name of the application
  publisher: string // Publisher/developer of the application
  version: string // Current version of the application
  description: string // Brief description of the application
}

/**
 * Interface for the API search response
 */
interface ApiSearchResult {
  Name: string // Display name of the application
  Id: string // Unique identifier for the app
  Version: string // Version string (may include tags/monikers)
  Source: string // Source repository
}

/**
 * Interface extending WingetApp with deployment configuration
 */
interface SelectedApp extends WingetApp {
  customDescription?: string // Custom description for the application
  customPublisher?: string // Custom publisher information
  isLocked: boolean // Whether the configuration is locked/confirmed
  isConfigured: boolean // Whether the app has been configured
  isExpanded: boolean // Whether the configuration panel is expanded
  deploymentStatus?: "pending" | "deploying" | "success" | "failed" // Status of deployment
  appId?: string // ID returned from the API after successful deployment
  errorMessage?: string // Error message if deployment failed
}

/**
 * Interface for the API request payload
 */
interface UploadRequest {
  path: string // Filesystem path to the .intunewin file
  display_name: string // Friendly name to show in Intune
  package_id: string // Winget package identifier
  publisher?: string // Publisher name (optional)
  description?: string // Description text (optional)
}

/**
 * Interface for the API response
 */
interface UploadResponse {
  app_id: string // ID of the deployed application
}

/**
 * WingetDeploymentPage component for bulk application deployment
 *
 * @returns An interface for searching, selecting, configuring, and deploying Winget applications
 */
export function WingetDeploymentPage() {
  // State for search functionality
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<WingetApp[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // State for selected applications
  const [selectedApps, setSelectedApps] = useState<SelectedApp[]>([])

  // State for deployment process
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploymentProgress, setDeploymentProgress] = useState(0)
  const [currentDeployingApp, setCurrentDeployingApp] = useState<string | null>(
    null,
  )
  const [deploymentError, setDeploymentError] = useState<string | null>(null)

  // State for dynamic API URL
  const [apiUrlBase, setApiUrlBase] = useState<string>("")

  useEffect(() => {
    // Check if we're running in Electron
    if (typeof window !== "undefined" && window.electronAPI) {
      // Get current API port
      window.electronAPI
        .getApiPort()
        .then((port: number) => {
          setApiUrlBase(`http://127.0.0.1:${port}`)
          console.log(`Set API URL base to: http://127.0.0.1:${port}`)
        })
        .catch((err: any) => {
          console.error("Failed to get API port:", err)
          // Fall back to default port
        })

      // Listen for API ready events (in case port changes)
      window.electronAPI.onApiReady((port: number) => {
        setApiUrlBase(`http://127.0.0.1:${port}`)
        console.log(`Updated API URL base to: http://127.0.0.1:${port}`)
      })

      // Cleanup listener on unmount
      return () => {
        if (window.electronAPI.removeAllListeners) {
          window.electronAPI.removeAllListeners("api-ready")
        }
      }
    }
  }, [])

  /**
   * Fetches search results from the API
   *
   * @param query - The search term to query
   * @returns Promise resolving to an array of WingetApp objects
   */
  const fetchSearchResults = async (query: string): Promise<WingetApp[]> => {
    try {
      const response = await fetch(
        `${apiUrlBase}/search?search_term=${encodeURIComponent(query)}`,
      )

      if (!response.ok) {
        throw new Error(`Search failed with status: ${response.status}`)
      }

      const data: ApiSearchResult[] = await response.json()

      // Map API response to our WingetApp interface
      return data.map((item) => {
        // Extract just the version number without tags/monikers
        const versionMatch = item.Version.match(/^([^\s]+)/)
        const version = versionMatch
          ? versionMatch[1]
          : item.Version.split(" ")[0]

        return {
          id: item.Id,
          name: item.Name,
          version: version,
          // Default values for fields not provided by the API
          publisher: "Unknown Publisher",
          description: `${item.Name} (${item.Id})`,
        }
      })
    } catch (error) {
      console.error("Error fetching search results:", error)
      throw error
    }
  }

  /**
   * Handles the search action
   */
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      return
    }

    setIsSearching(true)
    setSearchError(null)

    try {
      const results = await fetchSearchResults(searchQuery)
      setSearchResults(results)
    } catch (error) {
      setSearchError(
        error instanceof Error
          ? error.message
          : "Failed to search for applications",
      )
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  /**
   * Adds an application to the selected list
   *
   * @param app - The Winget application to add
   */
  const addApp = (app: WingetApp) => {
    // Only add if not already in the list
    if (!selectedApps.some((selectedApp) => selectedApp.id === app.id)) {
      setSelectedApps([
        ...selectedApps,
        {
          ...app,
          customDescription: app.description,
          customPublisher: app.publisher,
          isLocked: false,
          isConfigured: false,
          isExpanded: false,
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
   * Updates the configuration for a selected application
   *
   * @param appId - The ID of the application to update
   * @param field - The configuration field to update
   * @param value - The new value for the field
   */
  const updateAppConfig = (appId: string, field: string, value: string) => {
    setSelectedApps(
      selectedApps.map((app) => {
        if (app.id === appId) {
          return {
            ...app,
            [field]: value,
          }
        }
        return app
      }),
    )
  }

  /**
   * Toggles the expansion state of an application's configuration panel
   *
   * @param appId - The ID of the application to toggle
   */
  const toggleAppExpansion = (appId: string) => {
    setSelectedApps(
      selectedApps.map((app) => {
        if (app.id === appId && !app.isLocked) {
          return {
            ...app,
            isExpanded: !app.isExpanded,
          }
        }
        return app
      }),
    )
  }

  /**
   * Toggles the locked state of an application's configuration
   * Locked applications cannot be edited or removed
   *
   * @param appId - The ID of the application to toggle
   */
  const toggleLockApp = (appId: string) => {
    setSelectedApps(
      selectedApps.map((app) => {
        if (app.id === appId) {
          // An app is considered configured if it has both description and publisher
          const isConfigured = !!app.customDescription && !!app.customPublisher
          return {
            ...app,
            isLocked: !app.isLocked,
            isConfigured: isConfigured,
            isExpanded: false, // Close the panel when locking
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

      // Prepare request payload
      const payload: UploadRequest = {
        path: INTUNEWIN_PATH, // Use just the file path, not the full URL
        display_name: app.name,
        package_id: app.id,
        publisher: app.customPublisher || app.publisher,
        description: app.customDescription || app.description,
      }

      // Make API request
      const response = await fetch(`${apiUrlBase}/apps`, {
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

      // Return updated app with success status
      return {
        ...app,
        deploymentStatus: "success",
        appId: data.app_id,
      }
    } catch (error) {
      // Return updated app with failure status
      return {
        ...app,
        deploymentStatus: "failed",
        errorMessage:
          error instanceof Error ? error.message : "Unknown error occurred",
      }
    }
  }

  /**
   * Deploys all locked applications to Intune sequentially
   */
  const deployApps = async () => {
    const appsToDeployCount = selectedApps.filter((app) => app.isLocked).length
    if (appsToDeployCount === 0) {
      alert(
        "Please configure and lock at least one application for deployment.",
      )
      return
    }

    // Reset deployment state
    setIsDeploying(true)
    setDeploymentProgress(0)
    setCurrentDeployingApp(null)
    setDeploymentError(null)

    // Mark all locked apps as pending deployment
    setSelectedApps(
      selectedApps.map((app) =>
        app.isLocked ? { ...app, deploymentStatus: "pending" } : app,
      ),
    )

    // Get all locked apps
    const appsToDeployList = selectedApps.filter((app) => app.isLocked)
    let completedCount = 0
    let updatedApps = [...selectedApps]

    // Deploy apps one by one
    for (const app of appsToDeployList) {
      try {
        // Update app status to deploying
        updatedApps = updatedApps.map((a) =>
          a.id === app.id ? { ...a, deploymentStatus: "deploying" } : a,
        )
        setSelectedApps(updatedApps)

        // Deploy the app
        const deployedApp = await deployApp(app)

        // Update the app in the list with deployment result
        updatedApps = updatedApps.map((a) =>
          a.id === deployedApp.id ? deployedApp : a,
        )
        setSelectedApps(updatedApps)

        // Update progress
        completedCount++
        setDeploymentProgress(
          Math.round((completedCount / appsToDeployList.length) * 100),
        )
      } catch (error) {
        // Handle unexpected errors
        setDeploymentError(
          `Failed to deploy ${app.name}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        )

        // Update app status to failed
        updatedApps = updatedApps.map((a) =>
          a.id === app.id
            ? {
                ...a,
                deploymentStatus: "failed",
                errorMessage: "Deployment process failed",
              }
            : a,
        )
        setSelectedApps(updatedApps)

        // Update progress
        completedCount++
        setDeploymentProgress(
          Math.round((completedCount / appsToDeployList.length) * 100),
        )
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
    const successful = lockedApps.filter(
      (app) => app.deploymentStatus === "success",
    ).length
    const failed = lockedApps.filter(
      (app) => app.deploymentStatus === "failed",
    ).length
    const pending = lockedApps.filter(
      (app) =>
        app.deploymentStatus === "pending" ||
        app.deploymentStatus === "deploying",
    ).length

    return { total: lockedApps.length, successful, failed, pending }
  }

  // Get deployment statistics
  const deploymentStats = getDeploymentStats()

  return (
    <div className="flex flex-col gap-6">
      {/* Page header with title and deploy button */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Deploy with Winget</h2>
        <Button
          onClick={deployApps}
          disabled={!selectedApps.some((app) => app.isLocked) || isDeploying}
          className="flex items-center gap-2"
        >
          <Terminal className="h-4 w-4" />
          {isDeploying ? "Deploying..." : "Deploy to Intune"}
        </Button>
      </div>

      {/* Deployment Progress Section */}
      {isDeploying && (
        <Card>
          <CardHeader>
            <CardTitle>Deployment Progress</CardTitle>
            <CardDescription>
              Deploying applications to Intune (
              {deploymentStats.successful} of {deploymentStats.total} completed)
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
      {!isDeploying &&
        (deploymentStats.successful > 0 || deploymentStats.failed > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Deployment Results</CardTitle>
              <CardDescription>
                {deploymentStats.successful} successful,{" "}
                {deploymentStats.failed} failed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {selectedApps
                  .filter(
                    (app) =>
                      app.deploymentStatus === "success" ||
                      app.deploymentStatus === "failed",
                  )
                  .map((app) => (
                    <div
                      key={`result-${app.id}`}
                      className="mb-4 flex items-start gap-3 rounded-md border p-3 last:mb-0"
                    >
                      {app.deploymentStatus === "success" ? (
                        <CheckCircle className="mt-0.5 h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="mt-0.5 h-5 w-5 text-red-500" />
                      )}
                      <div className="flex-1">
                        <h4 className="font-medium">{app.name}</h4>
                        <p className="text-sm text-muted-foreground">{app.id}</p>
                        {app.deploymentStatus === "success" && app.appId && (
                          <p className="mt-1 text-xs">
                            App ID:{" "}
                            <code className="rounded bg-muted px-1 py-0.5">
                              {app.appId}
                            </code>
                          </p>
                        )}
                        {app.deploymentStatus === "failed" &&
                          app.errorMessage && (
                            <p className="mt-1 text-xs text-red-500">
                              {app.errorMessage}
                            </p>
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
        <CardHeader>
          <CardTitle>Search for Applications</CardTitle>
          <CardDescription>
            Search for applications in the Windows Package Manager repository
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search input and button */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by name or ID (e.g., vscode, Microsoft.VisualStudioCode)"
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
          </div>

          {/* Search Error */}
          {searchError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Search Error</AlertTitle>
              <AlertDescription>{searchError}</AlertDescription>
            </Alert>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 font-medium">
                Search Results ({searchResults.length})
              </h3>
              <ScrollArea className="h-[300px] rounded-md border">
                <div className="p-4">
                  {searchResults.map((app) => (
                    <div
                      key={app.id}
                      className="mb-4 flex items-start justify-between rounded-lg border p-3 last:mb-0"
                    >
                      {/* App information */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{app.name}</h4>
                          <Badge variant="outline" className="text-xs">
                            {app.version}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {app.description}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          <span className="font-medium">ID:</span> {app.id}
                        </p>
                      </div>
                      {/* Add button */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-2 flex items-center gap-1"
                        onClick={() => addApp(app)}
                        disabled={selectedApps.some(
                          (selectedApp) => selectedApp.id === app.id,
                        )}
                      >
                        {selectedApps.some(
                          (selectedApp) => selectedApp.id === app.id,
                        ) ? (
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
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Apps Section */}
      {selectedApps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Selected Applications ({selectedApps.length})</CardTitle>
            <CardDescription>
              Configure and prepare applications for deployment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {selectedApps.map((app) => (
                <div
                  key={app.id}
                  className="overflow-hidden rounded-lg border"
                >
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
                        <Terminal className="h-4 w-4" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{app.name}</h4>
                          <Badge variant="outline" className="text-xs">
                            {app.version}
                          </Badge>
                          {/* Status badges */}
                          {app.deploymentStatus === "success" && (
                            <Badge
                              variant="default"
                              className="bg-green-500 text-xs"
                            >
                              Deployed
                            </Badge>
                          )}
                          {app.deploymentStatus === "failed" && (
                            <Badge
                              variant="default"
                              className="bg-red-500 text-xs"
                            >
                              Failed
                            </Badge>
                          )}
                          {app.deploymentStatus === "deploying" && (
                            <Badge
                              variant="default"
                              className="bg-blue-500 text-xs"
                            >
                              Deploying...
                            </Badge>
                          )}
                          {app.isLocked && !app.deploymentStatus && (
                            <Badge
                              variant="default"
                              className="bg-green-500 text-xs"
                            >
                              Ready to Deploy
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{app.id}</p>
                      </div>
                    </div>
                    {/* Action buttons - only shown if not currently deploying */}
                    {!isDeploying && (
                      <div className="flex items-center gap-2">
                        {/* Remove button - only visible when not locked */}
                        {!app.isLocked && !app.deploymentStatus && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => removeApp(app.id)}
                          >
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
                            {app.isLocked ? "Unlock" : "Lock Configuration"}
                          </Button>
                        )}
                        {/* Expand/Collapse button - only visible when not locked and not deployed */}
                        {!app.isLocked && !app.deploymentStatus && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => toggleAppExpansion(app.id)}
                          >
                            {app.isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            <span className="sr-only">Toggle</span>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Configuration Panel - only visible when expanded and not locked */}
                  {app.isExpanded && !app.isLocked && (
                    <div className="border-t p-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        {/* Description field */}
                        <div className="space-y-2">
                          <Label htmlFor={`${app.id}-description`}>
                            Description
                          </Label>
                          <Textarea
                            id={`${app.id}-description`}
                            placeholder="Enter application description"
                            className="min-h-[100px]"
                            value={app.customDescription || ""}
                            onChange={(e) =>
                              updateAppConfig(
                                app.id,
                                "customDescription",
                                e.target.value,
                              )
                            }
                            disabled={app.isLocked}
                          />
                          <p className="text-xs text-muted-foreground">
                            Provide a description of the application for
                            documentation
                          </p>
                        </div>

                        {/* Publisher field */}
                        <div className="space-y-2">
                          <Label htmlFor={`${app.id}-publisher`}>Publisher</Label>
                          <Input
                            id={`${app.id}-publisher`}
                            placeholder="e.g., Microsoft Corporation"
                            value={app.customPublisher || ""}
                            onChange={(e) =>
                              updateAppConfig(
                                app.id,
                                "customPublisher",
                                e.target.value,
                              )
                            }
                            disabled={app.isLocked}
                          />
                          <p className="text-xs text-muted-foreground">
                            Specify the publisher or developer of the
                            application
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={deployApps}
              disabled={
                !selectedApps.some(
                  (app) => app.isLocked && !app.deploymentStatus,
                ) || isDeploying
              }
              className="w-full"
            >
              {isDeploying
                ? `Deploying... (${deploymentStats.successful}/${deploymentStats.total})`
                : `Deploy ${
                    selectedApps.filter(
                      (app) => app.isLocked && !app.deploymentStatus,
                    ).length
                  } Applications to Intune`}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}