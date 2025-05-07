"use client"

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
import { Trash2, AlertTriangle, Loader2, AlertCircle } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface DeleteVersionDialogProps {
  versionId: string
  appName: string
  version: string
  onVersionDeleted: () => void
}

export function DeleteVersionDialog({ versionId, appName, version, onVersionDeleted }: DeleteVersionDialogProps) {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmationStep, setConfirmationStep] = useState(1)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const resetDialog = () => {
    setConfirmationStep(1)
    setErrorMessage(null)
  }

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      resetDialog()
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/app-library/versions/${versionId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        // Extract error message from response
        const message = data.error || "Failed to delete version"
        setErrorMessage(message)

        // Show toast with error message
        toast({
          title: "Cannot delete version",
          description: message,
          variant: "destructive",
        })

        // Don't close the dialog yet - let the user see the error
        setIsDeleting(false)
        return
      }

      // Success case
      toast({
        title: "Version moved to trash",
        description: `Version ${version} of ${appName} has been moved to the trash. You can restore it from the Recently Deleted section.`,
      })

      setOpen(false)
      resetDialog()
      onVersionDeleted()
    } catch (error) {
      console.error("Error deleting version:", error)

      const message = error instanceof Error ? error.message : "An unknown error occurred"
      setErrorMessage(message)

      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleNextStep = () => {
    setConfirmationStep(2)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="sr-only">Delete</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-red-500 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Delete Version
          </DialogTitle>
          <DialogDescription>
            {confirmationStep === 1 &&
              "This will move this version to the trash. You can restore it from the Recently Deleted section."}
            {confirmationStep === 2 && "Final confirmation required. Are you sure you want to delete this version?"}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Display error message if there is one */}
          {errorMessage && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {confirmationStep === 1 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                You are about to delete version <strong>{version}</strong> of <strong>{appName}</strong>. This will move
                the version to the trash.
                {versionId.includes("current") && (
                  <p className="mt-2 font-semibold">
                    This is the current version of the application. Deleting it will require setting a new current
                    version.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {confirmationStep === 2 && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Final Warning</AlertTitle>
                <AlertDescription>
                  <p>You are about to move to trash:</p>
                  <ul className="list-disc pl-5 mt-2">
                    <li>
                      Version: <strong>{version}</strong>
                    </li>
                    <li>
                      Application: <strong>{appName}</strong>
                    </li>
                    <li>All deployment records associated with this version</li>
                  </ul>
                  <p className="mt-2">You can restore this version from the Recently Deleted section.</p>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>

          {confirmationStep === 1 ? (
            <Button variant="destructive" onClick={handleNextStep}>
              Continue
            </Button>
          ) : (
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Moving to Trash...
                </>
              ) : (
                "Move to Trash"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
