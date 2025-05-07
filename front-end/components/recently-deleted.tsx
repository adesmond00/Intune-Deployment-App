"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"
import { Loader2, RefreshCw, RotateCcw, Trash2, AlertTriangle } from "lucide-react"
import { dbConfig } from "@/lib/db-config"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface DeletedApp {
  id: string
  app_id: string
  name: string
  publisher: string
  description: string | null
  category: string | null
  deleted_at: string
}

interface DeletedVersion {
  id: string
  version_id: string
  version: string
  app_id: string
  app_name: string
  app_id_code: string
  release_notes: string | null
  deleted_at: string
}

interface RecentlyDeletedProps {
  onRefresh?: () => void
}

export function RecentlyDeleted({ onRefresh }: RecentlyDeletedProps = {}) {
  const [activeTab, setActiveTab] = useState("apps")
  const [isLoading, setIsLoading] = useState(true)
  const [deletedApps, setDeletedApps] = useState<DeletedApp[]>([])
  const [deletedVersions, setDeletedVersions] = useState<DeletedVersion[]>([])

  // State for confirmation dialogs
  const [confirmDeleteAppDialog, setConfirmDeleteAppDialog] = useState(false)
  const [confirmDeleteVersionDialog, setConfirmDeleteVersionDialog] = useState(false)
  const [confirmEmptyTrashDialog, setConfirmEmptyTrashDialog] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchDeletedItems()
  }, [])

  const fetchDeletedItems = async () => {
    setIsLoading(true)
    try {
      // Fetch deleted apps
      const appsResponse = await fetch("/api/app-library/trash/apps")
      if (!appsResponse.ok) throw new Error("Failed to fetch deleted apps")
      const appsData = await appsResponse.json()
      setDeletedApps(appsData)

      // Fetch deleted versions
      const versionsResponse = await fetch("/api/app-library/trash/versions")
      if (!versionsResponse.ok) throw new Error("Failed to fetch deleted versions")
      const versionsData = await versionsResponse.json()
      setDeletedVersions(versionsData)

      // Call the onRefresh callback if provided
      if (onRefresh) {
        onRefresh()
      }
    } catch (error) {
      console.error("Error fetching deleted items:", error)
      toast({
        title: "Error",
        description: "Failed to fetch deleted items",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const restoreApp = async (appId: string) => {
    try {
      const response = await fetch(`/api/app-library/apps/${appId}`, {
        method: "PATCH",
      })

      if (!response.ok) throw new Error("Failed to restore app")

      toast({
        title: "App restored",
        description: "The application has been restored successfully",
      })

      // Refresh the list
      fetchDeletedItems()
    } catch (error) {
      console.error("Error restoring app:", error)
      toast({
        title: "Error",
        description: "Failed to restore application",
        variant: "destructive",
      })
    }
  }

  const restoreVersion = async (versionId: string) => {
    try {
      const response = await fetch(`/api/app-library/versions/${versionId}`, {
        method: "PATCH",
      })

      if (!response.ok) throw new Error("Failed to restore version")

      toast({
        title: "Version restored",
        description: "The version has been restored successfully",
      })

      // Refresh the list
      fetchDeletedItems()
    } catch (error) {
      console.error("Error restoring version:", error)
      toast({
        title: "Error",
        description: "Failed to restore version",
        variant: "destructive",
      })
    }
  }

  const confirmDeleteApp = (appId: string) => {
    setItemToDelete(appId)
    setConfirmDeleteAppDialog(true)
  }

  const confirmDeleteVersion = (versionId: string) => {
    setItemToDelete(versionId)
    setConfirmDeleteVersionDialog(true)
  }

  const permanentlyDeleteApp = async () => {
    if (!itemToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/app-library/trash/apps/${itemToDelete}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to permanently delete app")

      toast({
        title: "App permanently deleted",
        description: "The application has been permanently deleted",
      })

      // Refresh the list
      fetchDeletedItems()
    } catch (error) {
      console.error("Error permanently deleting app:", error)
      toast({
        title: "Error",
        description: "Failed to permanently delete application",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setConfirmDeleteAppDialog(false)
      setItemToDelete(null)
    }
  }

  const permanentlyDeleteVersion = async () => {
    if (!itemToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/app-library/trash/versions/${itemToDelete}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to permanently delete version")

      toast({
        title: "Version permanently deleted",
        description: "The version has been permanently deleted",
      })

      // Refresh the list
      fetchDeletedItems()
    } catch (error) {
      console.error("Error permanently deleting version:", error)
      toast({
        title: "Error",
        description: "Failed to permanently delete version",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setConfirmDeleteVersionDialog(false)
      setItemToDelete(null)
    }
  }

  const emptyTrash = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch("/api/app-library/trash/empty", {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to empty trash")

      toast({
        title: "Trash emptied",
        description: "All items in the trash have been permanently deleted",
      })

      // Refresh the list
      fetchDeletedItems()
    } catch (error) {
      console.error("Error emptying trash:", error)
      toast({
        title: "Error",
        description: "Failed to empty trash",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setConfirmEmptyTrashDialog(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Recently Deleted</CardTitle>
            <CardDescription>
              Items in trash will be automatically deleted after {dbConfig.trashRetentionDays} days
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchDeletedItems} disabled={isLoading} className="gap-1">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            {(deletedApps.length > 0 || deletedVersions.length > 0) && (
              <Button
                variant="destructive"
                onClick={() => setConfirmEmptyTrashDialog(true)}
                disabled={isLoading}
                className="gap-1"
              >
                <Trash2 className="h-4 w-4" />
                Empty Trash
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="apps">
                Applications{" "}
                <Badge variant="secondary" className="ml-2">
                  {deletedApps.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="versions">
                Versions{" "}
                <Badge variant="secondary" className="ml-2">
                  {deletedVersions.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="apps" className="mt-4">
              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : deletedApps.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No deleted applications found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Application</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Deleted</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deletedApps.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{app.name}</div>
                            <div className="text-sm text-muted-foreground">{app.publisher}</div>
                          </div>
                        </TableCell>
                        <TableCell>{app.app_id}</TableCell>
                        <TableCell>{new Date(app.deleted_at).toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => restoreApp(app.app_id)}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Restore
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20"
                              onClick={() => confirmDeleteApp(app.app_id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="versions" className="mt-4">
              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : deletedVersions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No deleted versions found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Application</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Deleted</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deletedVersions.map((version) => (
                      <TableRow key={version.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{version.app_name}</div>
                            <div className="text-sm text-muted-foreground">{version.app_id_code}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{version.version}</Badge>
                        </TableCell>
                        <TableCell>{new Date(version.deleted_at).toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => restoreVersion(version.version_id)}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Restore
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20"
                              onClick={() => confirmDeleteVersion(version.version_id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Confirmation Dialog for App Deletion */}
      <Dialog open={confirmDeleteAppDialog} onOpenChange={setConfirmDeleteAppDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Confirm Permanent Deletion
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the application and all its data.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to permanently delete this application?</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteAppDialog(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={permanentlyDeleteApp} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Permanently"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Version Deletion */}
      <Dialog open={confirmDeleteVersionDialog} onOpenChange={setConfirmDeleteVersionDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Confirm Permanent Deletion
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the version and all its data.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to permanently delete this version?</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteVersionDialog(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={permanentlyDeleteVersion} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Permanently"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Empty Trash */}
      <Dialog open={confirmEmptyTrashDialog} onOpenChange={setConfirmEmptyTrashDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Empty Trash
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete all items in the trash.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to permanently delete all items in the trash?</p>
            <p className="mt-2 text-sm text-muted-foreground">
              This will delete {deletedApps.length} applications and {deletedVersions.length} versions.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmEmptyTrashDialog(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={emptyTrash} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Emptying Trash...
                </>
              ) : (
                "Empty Trash"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
