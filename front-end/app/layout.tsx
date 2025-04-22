import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

// Load the Inter font with Latin character subset
const inter = Inter({ subsets: ["latin"] })

// Define metadata for the application (used for SEO and browser tabs)
export const metadata: Metadata = {
  title: "Intune Deployment App",
  description: "Bulk deploy applications to Microsoft Intune",
    generator: 'v0.dev'
}

/**
 * RootLayout component that wraps all pages in the application
 *
 * @param children - The page content to be rendered inside the layout
 * @returns The complete HTML structure with theme support
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
