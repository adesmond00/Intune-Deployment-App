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
  ChevronDown,
  ChevronUp,
  Lock,
  Plus,
  Search,
  Package,
  Trash2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Wand2,
  Loader2,
  Copy,
  CheckIcon,
  History,
} from "lucide-react"
import { useState, useEffect } from "react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus, vs } from "react-syntax-highlighter/dist/esm/styles/prism"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
  name: string // Display name of the application
  publisher: string // Publisher/developer of the application
  version: string // Current version of the application
  description: string // Brief description of the application
  category?: string // Optional category for the application
  lastUpdated?: string // Optional date when the app was last updated
}

/**
 * Interface for a specific version of an application
 */
interface AppVersion {
  id: string // Unique identifier for this specific version
  version: string // Version number
  lastUpdated: string // Date when this version was added/updated
  notes?: string // Optional release notes
}

/**
 * Interface for the API search response
 */
interface ApiSearchResult {
  id: string // Unique identifier for the app
  name: string // Display name of the application
  version: string // Version string
  publisher: string // Publisher name
  description: string // App description
  category: string // App category
  lastUpdated: string // Date when the app was last updated
}

/**
 * Interface extending AppLibraryApp with deployment configuration
 */
interface SelectedApp extends AppLibraryApp {
  customDescription?: string // Custom description for the application
  customPublisher?: string // Custom publisher information
  detectionScript?: string // PowerShell detection script for the application
  isGeneratingScript?: boolean // Whether a detection script is being generated
  isLocked: boolean // Whether the configuration is locked/confirmed
  isConfigured: boolean // Whether the app has been configured
  isExpanded: boolean // Whether the configuration panel is expanded
  deploymentStatus?: "pending" | "deploying" | "success" | "failed" // Status of deployment
  appId?: string // ID returned from the API after successful deployment
  errorMessage?: string // Error message if deployment failed
  isEditingScript?: boolean // Whether the script is being edited
}

/**
 * Interface for the API request payload
 */
interface UploadRequest {
  path: string // Filesystem path to the .intunewin file
  display_name: string // Friendly name to show in Intune
  package_id: string // App library package identifier
  publisher?: string // Publisher name (optional)
  description?: string // Description text (optional)
  detection_script?: string // PowerShell detection script (optional)
}

/**
 * Interface for the API response
 */
interface UploadResponse {
  intune_app_id: string // ID of the deployed application returned by backend
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
   * Fetches search results from API
   *
   * @param query - The search term to query
   * @returns Promise resolving to an array of AppLibraryApp objects
   */
  const fetchSearchResults = async (query: string): Promise<AppLibraryApp[]> => {
    const url = `${API_BASE_URL}/db/apps?name=${encodeURIComponent(query)}`
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`API error (${res.status}) while searching apps`)
    }

    const rows: any[] = await res.json()

    // Map DB rows → AppLibraryApp
    return rows.map((row) => ({
      id: String(row.id),
      name: row.app_name,
      version: row.version,
      description: row.detection_rule || "",
      publisher: row.publisher || "",
      category: "Internal",
      lastUpdated: row.created_at,
    }))
  }

  /**
   * Fetches version history for an application from API
   *
   * @param app - The application to fetch versions for
   * @returns Promise resolving to an array of AppVersion objects
   */
  const fetchAppVersions = async (app: AppLibraryApp): Promise<AppVersion[]> => {
    const url = `${API_BASE_URL}/db/apps?name=${encodeURIComponent(app.name)}`
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`API error (${res.status}) while fetching versions`)
    }
    const rows: any[] = await res.json()
    return rows.map((row) => ({
      id: String(row.id),
      version: row.version,
      lastUpdated: row.created_at,
      notes: undefined,
    }))
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
    const versionedApp: AppLibraryApp = {
      ...app,
      id: version.id,
      version: version.version,
      lastUpdated: version.lastUpdated,
    }

    if (!selectedApps.some((selectedApp) => selectedApp.id === version.id)) {
      setSelectedApps([
        ...selectedApps,
        {
          ...versionedApp,
          customDescription: app.description,
          customPublisher: app.publisher,
          detectionScript: "",
          isLocked: false,
          isConfigured: false,
          isExpanded: false,
          isEditingScript: false,
        },
      ])

      // Close the modal after adding
      setVersionHistoryOpen(false)
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
      setSearchError(error instanceof Error ? error.message : "Failed to search for applications")
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  /**
   * Adds an application to the selected list
   *
   * @param app - The App Library application to add
   */
  const addApp = (app: AppLibraryApp) => {
    // Only add if not already in the list
    if (!selectedApps.some((selectedApp) => selectedApp.id === app.id)) {
      setSelectedApps([
        ...selectedApps,
        {
          ...app,
          customDescription: app.description,
          customPublisher: app.publisher,
          detectionScript: "",
          isLocked: false,
          isConfigured: false,
          isExpanded: false,
          isEditingScript: false,
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
            isEditingScript: false, // Exit edit mode when locking
          }
        }
        return app
      }),
    )
  }

  /**
   * Toggles the script editing mode for an application
   *
   * @param appId - The ID of the application to toggle editing for
   */
  const toggleScriptEditing = (appId: string) => {
    setSelectedApps(
      selectedApps.map((app) => {
        if (app.id === appId && !app.isLocked) {
          return {
            ...app,
            isEditingScript: !app.isEditingScript,
          }
        }
        return app
      }),
    )
  }

  /**
   * Copies the detection script to clipboard
   *
   * @param appId - The ID of the application whose script to copy
   */
  const copyScriptToClipboard = (appId: string) => {
    const app = selectedApps.find((app) => app.id === appId)
    if (app?.detectionScript) {
      navigator.clipboard.writeText(app.detectionScript)
      setCopiedScriptId(appId)
    }
  }

  /**
   * Generates a detection script for an application
   *
   * @param appId - The ID of the application to generate a script for
   */
  const generateDetectionScript = async (appId: string) => {
    // Find the app
    const app = selectedApps.find((app) => app.id === appId)
    if (!app) return

    // Set the app to generating state
    setSelectedApps(
      selectedApps.map((a) => {
        if (a.id === appId) {
          return {
            ...a,
            isGeneratingScript: true,
            isEditingScript: false, // Exit edit mode when generating
          }
        }
        return a
      }),
    )

    try {
      // In a real implementation, this would call the LLM API
      // For now, simulate an API call with a timeout
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Generate a dummy PowerShell detection script based on the app details
      const dummyScript = `# Detection script for ${app.name} (${app.id})
# Generated automatically for Intune deployment from App Library

$appName = "${app.name}"
$appId = "${app.id}"
$publisher = "${app.customPublisher || app.publisher}"
$version = "${app.version}"

# Check if the application is installed
try {
    $installedApp = Get-WmiObject -Class Win32_Product | Where-Object { $_.Name -like "*$appName*" }
    
    if ($installedApp) {
        Write-Host "Application $appName is installed (Version: $($installedApp.Version))"
        # Check if the installed version is equal or newer
        if ([System.Version]$installedApp.Version -ge [System.Version]"${app.version}") {
            Write-Host "Installed version is current or newer"
            exit 0
        } else {
            Write-Host "Installed version is older than required version"
            exit 1
        }
    } else {
        Write-Host "Application $appName is not installed"
        exit 1
    }
} catch {
    Write-Host "Error checking installation status: $_"
    exit 1
}
`

      // Update the app with the generated script
      setSelectedApps(
        selectedApps.map((a) => {
          if (a.id === appId) {
            return {
              ...a,
              detectionScript: dummyScript,
              isGeneratingScript: false,
            }
          }
          return a
        }),
      )
    } catch (error) {
      console.error("Error generating detection script:", error)

      // Update the app to show generation failed
      setSelectedApps(
        selectedApps.map((a) => {
          if (a.id === appId) {
            return {
              ...a,
              isGeneratingScript: false,
            }
          }
          return a
        }),
      )
    }
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

      // Make API request – package_id is a query parameter per backend spec
      const response = await fetch(
        `${API_BASE_URL}/db/apps/${app.id}/deploy?package_id=${encodeURIComponent(app.id)}`,
        { method: "POST" },
      )

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
        appId: data.intune_app_id,
      }
    } catch (error) {
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
      alert("Please configure and lock at least one application for deployment.")
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

  return (
    <div className="flex flex-col gap-6">
      {/* Page header with title and deploy button */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Deploy from App Library</h2>
        <Button
          onClick={deployApps}
          disabled={!selectedApps.some((app) => app.isLocked) || isDeploying}
          className="flex items-center gap-2"
        >
          <Package className="h-4 w-4" />
          {isDeploying ? "Deploying..." : "Deploy to Intune"}
        </Button>
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
                      <p className="text-sm text-muted-foreground">{app.id}</p>
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
        <CardHeader>
          <CardTitle>Search App Library</CardTitle>
          <CardDescription>Search for applications in your organization's app library</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search input and button */}
          <div className="flex gap-2">
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
              <h3 className="mb-2 font-medium">Search Results ({searchResults.length})</h3>
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
                            <span className="font-medium">ID:</span> {app.id}
                          </p>
                          {app.lastUpdated && (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium">Updated:</span> {app.lastUpdated}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Add button */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-2 flex items-center gap-1"
                        onClick={() => addApp(app)}
                        disabled={selectedApps.some((selectedApp) => selectedApp.id === app.id)}
                      >
                        {selectedApps.some((selectedApp) => selectedApp.id === app.id) ? (
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

      {/* Version History Modal */}
      <Dialog open={versionHistoryOpen} onOpenChange={setVersionHistoryOpen}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
            <DialogDescription>{currentAppVersions?.app.name} - Select a version to deploy</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>App ID</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Release Notes</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentAppVersions?.versions.map((version) => (
                  <TableRow key={version.id}>
                    <TableCell className="font-medium">{version.version}</TableCell>
                    <TableCell>{version.id}</TableCell>
                    <TableCell>{version.lastUpdated}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{version.notes || "No release notes"}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addAppVersion(currentAppVersions.app, version)}
                        disabled={selectedApps.some((app) => app.id === version.id)}
                      >
                        {selectedApps.some((app) => app.id === version.id) ? (
                          <>
                            <Check className="h-3 w-3 mr-1" /> Added
                          </>
                        ) : (
                          <>
                            <Plus className="h-3 w-3 mr-1" /> Add
                          </>
                        )}
                      </Button>
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
            <CardDescription>Configure and prepare applications for deployment</CardDescription>
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
                            {app.isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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
                          <Label htmlFor={`${app.id}-description`}>Description</Label>
                          <Textarea
                            id={`${app.id}-description`}
                            placeholder="Enter application description"
                            className="min-h-[100px]"
                            value={app.customDescription || ""}
                            onChange={(e) => updateAppConfig(app.id, "customDescription", e.target.value)}
                            disabled={app.isLocked}
                          />
                          <p className="text-xs text-muted-foreground">
                            Provide a description of the application for documentation
                          </p>
                        </div>

                        {/* Publisher field */}
                        <div className="space-y-2">
                          <Label htmlFor={`${app.id}-publisher`}>Publisher</Label>
                          <Input
                            id={`${app.id}-publisher`}
                            placeholder="e.g., Microsoft Corporation"
                            value={app.customPublisher || ""}
                            onChange={(e) => updateAppConfig(app.id, "customPublisher", e.target.value)}
                            disabled={app.isLocked}
                          />
                          <p className="text-xs text-muted-foreground">
                            Specify the publisher or developer of the application
                          </p>
                        </div>
                      </div>

                      {/* Detection Script field */}
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor={`${app.id}-detection-script`}>Detection Script</Label>
                          <div className="flex items-center gap-1">
                            {/* Copy button */}
                            {app.detectionScript && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0"
                                      onClick={() => copyScriptToClipboard(app.id)}
                                    >
                                      {copiedScriptId === app.id ? (
                                        <CheckIcon className="h-4 w-4 text-green-500" />
                                      ) : (
                                        <Copy className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{copiedScriptId === app.id ? "Copied!" : "Copy script"}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            {/* Edit/View toggle button */}
                            {app.detectionScript && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0"
                                      onClick={() => toggleScriptEditing(app.id)}
                                    >
                                      {app.isEditingScript ? (
                                        <CheckIcon className="h-4 w-4" />
                                      ) : (
                                        <Package className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{app.isEditingScript ? "Save changes" : "Edit script"}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            {/* Generate script button */}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={() => generateDetectionScript(app.id)}
                                    disabled={app.isGeneratingScript}
                                  >
                                    {app.isGeneratingScript ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Wand2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Generate detection script</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                        <div className="relative">
                          {/* Show syntax highlighted view when not editing */}
                          {!app.isEditingScript && app.detectionScript ? (
                            <div className="rounded-md border overflow-hidden">
                              <div className="bg-muted px-3 py-1.5 text-xs font-medium flex items-center justify-between">
                                <span>PowerShell</span>
                                {app.detectionScript && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 px-1.5 text-xs"
                                    onClick={() => toggleScriptEditing(app.id)}
                                  >
                                    Edit
                                  </Button>
                                )}
                              </div>
                              <div className="relative">
                                <SyntaxHighlighter
                                  language="powershell"
                                  style={isDarkTheme ? vscDarkPlus : vs}
                                  customStyle={{
                                    margin: 0,
                                    padding: "1rem",
                                    fontSize: "0.875rem",
                                    borderRadius: 0,
                                    minHeight: "150px",
                                    maxHeight: "350px",
                                    overflow: "auto",
                                  }}
                                >
                                  {app.detectionScript || "# No detection script generated yet"}
                                </SyntaxHighlighter>
                              </div>
                            </div>
                          ) : (
                            <Textarea
                              id={`${app.id}-detection-script`}
                              placeholder="PowerShell detection script"
                              className="min-h-[150px] font-mono text-sm"
                              value={app.detectionScript || ""}
                              onChange={(e) => updateAppConfig(app.id, "detectionScript", e.target.value)}
                              disabled={app.isLocked || app.isGeneratingScript}
                            />
                          )}
                          {app.isGeneratingScript && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                              <div className="flex flex-col items-center gap-2">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                <span className="text-sm font-medium">Generating script...</span>
                              </div>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          PowerShell script to detect if the application is installed
                        </p>
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
    </div>
  )
}
