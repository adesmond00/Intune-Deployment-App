"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Loader2 } from "lucide-react"
import { getSignedUrl, getFileNameFromPath } from "@/lib/backblaze-utils"

interface FileDownloadButtonProps {
  filePath: string
  label?: string
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive"
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
}

export function FileDownloadButton({
  filePath,
  label = "Download",
  variant = "outline",
  size = "sm",
  className = "",
}: FileDownloadButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleDownload = async () => {
    if (!filePath) return

    setIsLoading(true)

    try {
      // Get a signed URL for the file
      const signedUrl = await getSignedUrl(filePath)

      if (!signedUrl) {
        throw new Error("Failed to generate download URL")
      }

      // Create a temporary link and click it to start the download
      const link = document.createElement("a")
      link.href = signedUrl
      link.download = getFileNameFromPath(filePath)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error("Error downloading file:", error)
      alert("Failed to download file. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={`gap-1 ${className}`}
      onClick={handleDownload}
      disabled={isLoading || !filePath}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {label}
    </Button>
  )
}
