"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Loader2, Wand2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileUploader } from "@/components/file-uploader"

interface AddVersionDialogProps {
  appId: string
  appName: string
  currentVersion: string
  onVersionAdded: () => void
}

// Helper function to increment version number
const incrementVersion = (version: string): string => {
  // Split version into components (major.minor.patch)
  const parts = version.split(".")

  if (parts.length === 1) {
    // If single number, increment by 1
    return (Number.parseInt(parts[0]) + 1).toString()
  } else if (parts.length >= 2) {
    // If major.minor format, increment minor
    const minor = Number.parseInt(parts[1]) + 1
    return `${parts[0]}.${minor}`
  }

  // Default fallback
  return version
}

export function AddVersionDialog({ appId, appName, currentVersion, onVersionAdded }: AddVersionDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [activeTab, setActiveTab] = useState("details")
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    version: "",
    description: "",
    releaseNotes: "",
    detectionScript: "",
    installCommand: "",
    uninstallCommand: "",
    isCurrent: true,
    path: "",
  })

  // Track if we have a file uploaded
  const [hasFile, setHasFile] = useState(false)

  // Fetch current version details when dialog opens
  useEffect(() => {
    if (open) {
      fetchCurrentVersionDetails()
    }
  }, [open, appId])

  // Fetch the current version's details to pre-fill the form
  const fetchCurrentVersionDetails = async () => {
    setIsLoading(true)
    try {
      // Fetch all versions for this app
      const response = await fetch(`/api/app-library/versions?appId=${appId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch versions")
      }

      const versions = await response.json()

      // Find the current version
      const currentVersionDetails = versions.find((v: any) => v.is_current === true)

      if (currentVersionDetails) {
        // Pre-fill form with current version details, but increment the version number
        setFormData({
          version: incrementVersion(currentVersionDetails.version),
          description: currentVersionDetails.description || "",
          releaseNotes: "", // Start with empty release notes for the new version
          detectionScript: currentVersionDetails.detection_script || "",
          installCommand: currentVersionDetails.install_command || "",
          uninstallCommand: currentVersionDetails.uninstall_command || "",
          isCurrent: true,
          path: "", // Start with empty path since file needs to be uploaded
        })
      } else {
        // If no current version found, just set the version field
        setFormData((prev) => ({
          ...prev,
          version: incrementVersion(currentVersion),
        }))
      }
    } catch (error) {
      console.error("Error fetching current version details:", error)
      toast({
        title: "Error",
        description: "Failed to load current version details",
        variant: "destructive",
      })

      // Set default incremented version
      setFormData((prev) => ({
        ...prev,
        version: incrementVersion(currentVersion),
      }))
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleCheckboxChange = (checked: boolean) => {
    setFormData((prev) => ({ ...prev, isCurrent: checked }))
  }

  const handleFileUploaded = (filePath: string) => {
    setFormData((prev) => ({ ...prev, path: filePath }))
    setHasFile(true)
  }

  const handleFileRemoved = () => {
    setFormData((prev) => ({ ...prev, path: "" }))
    setHasFile(false)
  }

  const generateDetectionScript = async () => {
    setIsGeneratingScript(true)

    try {
      // In a real implementation, this would call an API
      // For now, simulate an API call with a timeout
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Generate a dummy PowerShell detection script based on the app details
      const dummyScript = `# Detection script for ${appName} version ${formData.version}
# Generated automatically for Intune deployment

$appName = "${appName}"
$version = "${formData.version}"

# Check if the application is installed
try {
  $installedApp = Get-WmiObject -Class Win32_Product | Where-Object { $_.Name -like "*$appName*" }
  
  if ($installedApp) {
      Write-Host "Application $appName is installed (Version: $($installedApp.Version))"
      # Check if the installed version is equal or newer
      if ([System.Version]$installedApp.Version -ge [System.Version]"${formData.version}") {
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

      setFormData((prev) => ({ ...prev, detectionScript: dummyScript }))
    } catch (error) {
      console.error("Error generating detection script:", error)
      toast({
        title: "Error",
        description: "Failed to generate detection script",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingScript(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Create request body
      const requestBody: any = {
        appId,
        version: formData.version,
        releaseNotes: formData.releaseNotes,
        detectionScript: formData.detectionScript,
        installCommand: formData.installCommand,
        uninstallCommand: formData.uninstallCommand,
        isCurrent: formData.isCurrent,
        description: formData.description || null,
      }

      // Add the file path if we have one
      if (formData.path) {
        requestBody.path = formData.path
      }

      const response = await fetch("/api/app-library/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to add version")
      }

      toast({
        title: "Version added successfully",
        description: `Version ${formData.version} has been added to ${appName}`,
      })

      // Reset form and close dialog
      setFormData({
        version: "",
        description: "",
        releaseNotes: "",
        detectionScript: "",
        installCommand: "",
        uninstallCommand: "",
        isCurrent: true,
        path: "",
      })
      setHasFile(false)
      setOpen(false)
      setActiveTab("details")

      // Notify parent component
      onVersionAdded()
    } catch (error) {
      console.error("Error adding version:", error)
      toast({
        title: "Error adding version",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Plus className="h-3 w-3" />
          Add Version
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading current version details...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Add New Version</DialogTitle>
              <DialogDescription>
                Add a new version for {appName}. Current version is {currentVersion}.
              </DialogDescription>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="details">Version Details</TabsTrigger>
                <TabsTrigger value="detection">Detection Script</TabsTrigger>
                <TabsTrigger value="commands">Commands</TabsTrigger>
                <TabsTrigger value="file">Package File</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="py-4">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="version">Version Number</Label>
                    <Input
                      id="version"
                      name="version"
                      placeholder="e.g., 1.1.0"
                      value={formData.version}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder="Description for this version"
                      value={formData.description}
                      onChange={handleChange}
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional. If left empty, the app's main description will be used.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="releaseNotes">Release Notes</Label>
                    <Textarea
                      id="releaseNotes"
                      name="releaseNotes"
                      placeholder="What's new in this version?"
                      value={formData.releaseNotes}
                      onChange={handleChange}
                      rows={4}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="isCurrent" checked={formData.isCurrent} onCheckedChange={handleCheckboxChange} />
                    <Label htmlFor="isCurrent" className="text-sm font-normal">
                      Set as current version (will replace {currentVersion})
                    </Label>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="detection" className="py-4">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="detectionScript">Detection Script</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateDetectionScript}
                      disabled={isGeneratingScript}
                      className="gap-1"
                    >
                      {isGeneratingScript ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Wand2 className="h-3 w-3" />
                      )}
                      Generate Script
                    </Button>
                  </div>
                  <Textarea
                    id="detectionScript"
                    name="detectionScript"
                    placeholder="# PowerShell detection script to check if the application is installed"
                    value={formData.detectionScript}
                    onChange={handleChange}
                    rows={15}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    This PowerShell script will be used to detect if the application is installed on the target device.
                    The script should exit with code 0 if the application is installed, or code 1 if it is not.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="commands" className="py-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="installCommand">Install Command</Label>
                    <Textarea
                      id="installCommand"
                      name="installCommand"
                      placeholder="Enter the command to install this application"
                      value={formData.installCommand}
                      onChange={handleChange}
                      rows={4}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional. The command that will be used to install the application.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="uninstallCommand">Uninstall Command</Label>
                    <Textarea
                      id="uninstallCommand"
                      name="uninstallCommand"
                      placeholder="Enter the command to uninstall this application"
                      value={formData.uninstallCommand}
                      onChange={handleChange}
                      rows={4}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional. The command that will be used to uninstall the application.
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="file" className="py-4">
                <FileUploader
                  appId={appId}
                  version={formData.version}
                  onFileUploaded={handleFileUploaded}
                  onFileRemoved={handleFileRemoved}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Upload the .intunewin package file for this version. This file will be stored in BackBlaze and used
                  during deployment.
                </p>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Version"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
