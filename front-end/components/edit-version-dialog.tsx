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
import { Edit2, Loader2, Wand2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileUploader } from "@/components/file-uploader"

interface EditVersionDialogProps {
  appId: string
  appName: string
  versionId: string
  version: {
    version: string
    description?: string | null
    release_notes?: string | null
    detection_script?: string | null
    is_current: boolean
    path?: string | null
    install_command?: string | null
    uninstall_command?: string | null
  }
  onVersionUpdated: () => void
}

export function EditVersionDialog({ appId, appName, versionId, version, onVersionUpdated }: EditVersionDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [activeTab, setActiveTab] = useState("details")
  const [formData, setFormData] = useState({
    version: "",
    description: "",
    releaseNotes: "",
    detectionScript: "",
    isCurrent: false,
    path: "",
    installCommand: "",
    uninstallCommand: "",
  })
  const [isLoading, setIsLoading] = useState(false)

  // Fetch the latest version data when the dialog opens
  const fetchVersionData = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/app-library/versions/${versionId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch version data")
      }

      const versionData = await response.json()
      console.log("Fetched version data:", versionData)

      // Pre-fill form with version data
      setFormData({
        version: versionData.version || "",
        description: versionData.description || "",
        releaseNotes: versionData.release_notes || "",
        detectionScript: versionData.detection_script || "",
        isCurrent: versionData.is_current || false,
        path: versionData.path || "",
        installCommand: versionData.install_command || "",
        uninstallCommand: versionData.uninstall_command || "",
      })
    } catch (error) {
      console.error("Error fetching version data:", error)
      toast({
        title: "Error",
        description: "Failed to load version data",
        variant: "destructive",
      })

      // Fallback to using the prop data
      setFormData({
        version: version.version || "",
        description: version.description || "",
        releaseNotes: version.release_notes || "",
        detectionScript: version.detection_script || "",
        isCurrent: version.is_current || false,
        path: version.path || "",
        installCommand: version.install_command || "",
        uninstallCommand: version.uninstall_command || "",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Initialize form data when dialog opens
  useEffect(() => {
    if (open) {
      fetchVersionData()
    }
  }, [open, versionId])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleCheckboxChange = (checked: boolean) => {
    setFormData((prev) => ({ ...prev, isCurrent: checked }))
  }

  const handleFileUploaded = (filePath: string) => {
    setFormData((prev) => ({ ...prev, path: filePath }))
  }

  const handleFileRemoved = () => {
    setFormData((prev) => ({ ...prev, path: "" }))
  }

  const generateDetectionScript = async () => {
    setIsGeneratingScript(true)

    try {
      // Simulate an API call with a timeout
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Generate a dummy PowerShell detection script
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
      const response = await fetch(`/api/app-library/versions/${versionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: formData.version,
          description: formData.description, // Ensure this is not null if empty
          releaseNotes: formData.releaseNotes || null,
          detectionScript: formData.detectionScript || null,
          isCurrent: formData.isCurrent,
          path: formData.path || null,
          installCommand: formData.installCommand || null,
          uninstallCommand: formData.uninstallCommand || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update version")
      }

      toast({
        title: "Version updated successfully",
        description: `Version ${formData.version} has been updated`,
      })

      setOpen(false)
      onVersionUpdated()
    } catch (error) {
      console.error("Error updating version:", error)
      toast({
        title: "Error updating version",
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
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-blue-500 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/20"
        >
          <Edit2 className="h-3.5 w-3.5" />
          <span className="sr-only">Edit</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading version data...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Version</DialogTitle>
              <DialogDescription>
                Edit version {version.version} for {appName}
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
                    <Input id="version" name="version" value={formData.version} onChange={handleChange} required />
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
                      Set as current version
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
                      placeholder="Command to install the application"
                      value={formData.installCommand}
                      onChange={handleChange}
                      rows={3}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      The command that will be used to install the application on the target device.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="uninstallCommand">Uninstall Command</Label>
                    <Textarea
                      id="uninstallCommand"
                      name="uninstallCommand"
                      placeholder="Command to uninstall the application"
                      value={formData.uninstallCommand}
                      onChange={handleChange}
                      rows={3}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      The command that will be used to uninstall the application from the target device.
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="file" className="py-4">
                <FileUploader
                  appId={appId}
                  version={formData.version}
                  currentFilePath={formData.path}
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
                    Updating...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
