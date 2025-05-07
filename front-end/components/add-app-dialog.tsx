"use client"

import type React from "react"

import { useState } from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Loader2, Wand2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileUploader } from "@/components/file-uploader"

interface AddAppDialogProps {
  onAppAdded: () => void
}

export function AddAppDialog({ onAppAdded }: AddAppDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [activeTab, setActiveTab] = useState("details")
  const [formData, setFormData] = useState({
    name: "",
    publisher: "",
    description: "",
    category: "",
    version: "1.0.0",
    releaseNotes: "Initial release",
    detectionScript: "",
    installCommand: "",
    uninstallCommand: "",
    path: "",
  })

  // Track if we have a file uploaded
  const [hasFile, setHasFile] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (value: string) => {
    setFormData((prev) => ({ ...prev, category: value }))
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
    if (!formData.name) {
      toast({
        title: "Missing information",
        description: "Please enter the application name first",
        variant: "destructive",
      })
      return
    }

    setIsGeneratingScript(true)

    try {
      // In a real implementation, this would call an API
      // For now, simulate an API call with a timeout
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Generate a dummy PowerShell detection script based on the app details
      const dummyScript = `# Detection script for ${formData.name}
# Generated automatically for Intune deployment

$appName = "${formData.name}"
$publisher = "${formData.publisher || "Unknown Publisher"}"
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
      // First create the app
      const appResponse = await fetch("/api/app-library/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          publisher: formData.publisher,
          description: formData.description,
          category: formData.category,
        }),
      })

      if (!appResponse.ok) {
        const error = await appResponse.json()
        throw new Error(error.error || "Failed to create app")
      }

      const app = await appResponse.json()

      // Then create the initial version
      const versionRequestBody: any = {
        appId: app.app_id,
        version: formData.version,
        releaseNotes: formData.releaseNotes,
        detectionScript: formData.detectionScript,
        installCommand: formData.installCommand,
        uninstallCommand: formData.uninstallCommand,
        isCurrent: true,
      }

      // Add the file path if we have one
      if (formData.path) {
        versionRequestBody.path = formData.path
      }

      const versionResponse = await fetch("/api/app-library/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(versionRequestBody),
      })

      if (!versionResponse.ok) {
        const error = await versionResponse.json()
        throw new Error(error.error || "Failed to create version")
      }

      toast({
        title: "App added successfully",
        description: `${formData.name} has been added to the app library`,
      })

      // Reset form and close dialog
      setFormData({
        name: "",
        publisher: "",
        description: "",
        category: "",
        version: "1.0.0",
        releaseNotes: "Initial release",
        detectionScript: "",
        installCommand: "",
        uninstallCommand: "",
        path: "",
      })
      setHasFile(false)
      setOpen(false)
      setActiveTab("details")

      // Notify parent component
      onAppAdded()
    } catch (error) {
      console.error("Error adding app:", error)
      toast({
        title: "Error adding app",
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
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add New App
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Application</DialogTitle>
            <DialogDescription>Add a new application to your organization's app library.</DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details">App Details</TabsTrigger>
              <TabsTrigger value="detection">Detection Script</TabsTrigger>
              <TabsTrigger value="commands">Commands</TabsTrigger>
              <TabsTrigger value="file">Package File</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="py-4">
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Application Name</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="Microsoft Office 365"
                      value={formData.name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="publisher">Publisher</Label>
                    <Input
                      id="publisher"
                      name="publisher"
                      placeholder="Microsoft Corporation"
                      value={formData.publisher}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Productivity suite including Word, Excel, PowerPoint, and more."
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={formData.category} onValueChange={handleSelectChange}>
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Productivity">Productivity</SelectItem>
                        <SelectItem value="Design">Design</SelectItem>
                        <SelectItem value="Development">Development</SelectItem>
                        <SelectItem value="Communication">Communication</SelectItem>
                        <SelectItem value="Utilities">Utilities</SelectItem>
                        <SelectItem value="Security">Security</SelectItem>
                        <SelectItem value="Business">Business</SelectItem>
                        <SelectItem value="Web Browsers">Web Browsers</SelectItem>
                        <SelectItem value="Media">Media</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="version">Initial Version</Label>
                    <Input
                      id="version"
                      name="version"
                      placeholder="1.0.0"
                      value={formData.version}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="releaseNotes">Release Notes</Label>
                  <Textarea
                    id="releaseNotes"
                    name="releaseNotes"
                    placeholder="Initial release"
                    value={formData.releaseNotes}
                    onChange={handleChange}
                    rows={2}
                  />
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
                    {isGeneratingScript ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
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
                appId={formData.name.toLowerCase().replace(/\s+/g, "-")} // temporary appId for initial upload
                version={formData.version}
                onFileUploaded={handleFileUploaded}
                onFileRemoved={handleFileRemoved}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Upload the .intunewin package file for this application. This file will be stored in BackBlaze and used
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
                "Add Application"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
