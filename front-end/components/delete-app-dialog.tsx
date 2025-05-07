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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, AlertTriangle, Loader2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface DeleteAppDialogProps {
  appId: string
  appName: string
  onAppDeleted: () => void
}

export function DeleteAppDialog({ appId, appName, onAppDeleted }: DeleteAppDialogProps) {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmationStep, setConfirmationStep] = useState(1)
  const [confirmationText, setConfirmationText] = useState("")

  const resetDialog = () => {
    setConfirmationStep(1)
    setConfirmationText("")
  }

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      resetDialog()
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)

    try {
      const response = await fetch(`/api/app-library/apps/${appId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete app")
      }

      toast({
        title: "App moved to trash",
        description: `${appName} has been moved to the trash. You can restore it from the Recently Deleted section.`,
      })

      setOpen(false)
      resetDialog()
      onAppDeleted()
    } catch (error) {
      console.error("Error deleting app:", error)
      toast({
        title: "Error deleting app",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleNextStep = () => {
    if (confirmationStep === 1) {
      setConfirmationStep(2)
    } else if (confirmationStep === 2) {
      if (confirmationText === appName) {
        setConfirmationStep(3)
      } else {
        toast({
          title: "Confirmation failed",
          description: "The application name you entered doesn't match",
          variant: "destructive",
        })
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-red-500 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Delete Application
          </DialogTitle>
          <DialogDescription>
            {confirmationStep === 1 &&
              "This action will move the application to the trash. You can restore it from the Recently Deleted section."}
            {confirmationStep === 2 && "Type the application name to confirm deletion."}
            {confirmationStep === 3 &&
              "Final confirmation required. All versions and deployment records will be moved to trash."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {confirmationStep === 1 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                You are about to delete <strong>{appName}</strong> (ID: {appId}) from the app library. This will move
                all versions and deployment records associated with this application to the trash.
              </AlertDescription>
            </Alert>
          )}

          {confirmationStep === 2 && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Confirmation Required</AlertTitle>
                <AlertDescription>
                  To confirm deletion, please type the application name: <strong>{appName}</strong>
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="confirmationText">Application Name</Label>
                <Input
                  id="confirmationText"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder="Type the application name"
                />
              </div>
            </div>
          )}

          {confirmationStep === 3 && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Final Warning</AlertTitle>
                <AlertDescription>
                  <p>You are about to move to trash:</p>
                  <ul className="list-disc pl-5 mt-2">
                    <li>
                      Application: <strong>{appName}</strong>
                    </li>
                    <li>All versions of this application</li>
                    <li>All deployment records</li>
                  </ul>
                  <p className="mt-2">You can restore this application from the Recently Deleted section.</p>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>

          {confirmationStep < 3 ? (
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
