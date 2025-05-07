"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, File, X, CheckCircle, AlertCircle } from "lucide-react"
import { generateFilePath } from "@/lib/backblaze-utils"
import { getFileNameFromPath } from "@/lib/backblaze-utils"

interface FileUploaderProps {
  appId: string
  version?: string
  currentFilePath?: string
  onFileUploaded: (filePath: string) => void
  onFileRemoved?: () => void
}

export function FileUploader({ appId, version, currentFilePath, onFileUploaded, onFileRemoved }: FileUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [filePath, setFilePath] = useState<string | null>(currentFilePath || null)
  const [uploadCompleted, setUploadCompleted] = useState(!!currentFilePath)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadError(null)
    setIsUploading(true)
    setUploadProgress(0)

    // Start a "fake" progress simulation
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 95) {
          clearInterval(progressInterval)
          return 95
        }
        return prev + 5
      })
    }, 200)

    try {
      // Generate a unique path for the file
      const filePath = generateFilePath(appId, version)

      // Create FormData to send the file
      const formData = new FormData()
      formData.append("file", file)
      formData.append("path", filePath)

      // Upload the file
      const response = await fetch("/api/app-library/file-storage", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to upload file")
      }

      const data = await response.json()

      // Complete the progress bar
      clearInterval(progressInterval)
      setUploadProgress(100)

      // Set the file path and mark upload as completed
      setFilePath(data.path)
      setUploadCompleted(true)

      // Notify parent component
      onFileUploaded(data.path)
    } catch (error) {
      console.error("Error uploading file:", error)
      setUploadError(error instanceof Error ? error.message : "An unknown error occurred")
    } finally {
      clearInterval(progressInterval)
      setIsUploading(false)
    }
  }

  const handleRemoveFile = () => {
    setFilePath(null)
    setUploadCompleted(false)
    setUploadProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    if (onFileRemoved) {
      onFileRemoved()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-2">
        <Label htmlFor="file-upload">
          Intunewin Package File
          {!uploadCompleted && <span className="ml-1 text-muted-foreground">(Required)</span>}
        </Label>

        {!uploadCompleted ? (
          <div className="flex items-center gap-2">
            <Input
              ref={fileInputRef}
              id="file-upload"
              type="file"
              accept=".intunewin"
              onChange={handleFileChange}
              disabled={isUploading}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Browse
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
            <File className="h-5 w-5 text-blue-500" />
            <span className="flex-1 truncate">{filePath ? getFileNameFromPath(filePath) : "File uploaded"}</span>
            <Button type="button" variant="ghost" size="sm" onClick={handleRemoveFile} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
              <span className="sr-only">Remove file</span>
            </Button>
          </div>
        )}
      </div>

      {isUploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}

      {uploadCompleted && !isUploading && (
        <div className="flex items-center text-sm text-green-600">
          <CheckCircle className="h-4 w-4 mr-1" />
          File uploaded successfully
        </div>
      )}

      {uploadError && (
        <div className="flex items-center text-sm text-red-600">
          <AlertCircle className="h-4 w-4 mr-1" />
          {uploadError}
        </div>
      )}
    </div>
  )
}
