/**
 * Dashboard component for the Intune Deployment App
 *
 * This component renders the welcome page that users see when they first
 * visit the application. It provides a brief introduction and guides users
 * to the deployment functionality.
 */
import { ArrowRight, Package } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * Dashboard component with welcome message and quick navigation
 *
 * @returns The welcome page interface
 */
export default function Dashboard() {
  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Welcome</h2>
      </div>

      {/* Welcome card */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">Welcome to Intune Deployment App</CardTitle>
          </div>
          <CardDescription className="text-base">
            A streamlined solution for deploying Windows applications to Microsoft Intune
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            This application helps you search, configure, and deploy Windows applications to Microsoft Intune using the
            Windows Package Manager (winget). Simplify your deployment workflow with our intuitive interface.
          </p>

          <div className="rounded-lg bg-muted p-4">
            <h3 className="font-medium mb-2">Key Features:</h3>
            <ul className="space-y-2 list-disc pl-5">
              <li>Search the Windows Package Manager repository for applications</li>
              <li>Configure application deployment settings</li>
              <li>Deploy multiple applications in a single operation</li>
              <li>Track deployment progress and status</li>
              <li>View detailed deployment results</li>
            </ul>
          </div>
        </CardContent>
        <CardFooter>
          <Button asChild size="lg" className="gap-2">
            <Link href="/deployments/winget">
              Get Started with Winget Deployment <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardFooter>
      </Card>

      {/* Quick help card */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
          <CardDescription>Resources to get you started</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">
            <strong>Documentation:</strong> Check our comprehensive documentation for detailed guides and tutorials.
          </p>
          <p className="text-sm">
            <strong>Support:</strong> Contact our support team if you encounter any issues or have questions.
          </p>
          <p className="text-sm">
            <strong>Feedback:</strong> We value your input! Let us know how we can improve the application.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
