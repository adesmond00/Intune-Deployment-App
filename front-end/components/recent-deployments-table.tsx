/**
 * RecentDeploymentsTable component for the Intune Deployment App
 *
 * This component displays a table of recent deployment activities,
 * showing deployment ID, application name, date, and status.
 */
import { CheckCircle, Clock, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

/**
 * RecentDeploymentsTable component showing recent deployment activities
 *
 * @returns A table displaying recent deployment information
 */
export function RecentDeploymentsTable() {
  // Placeholder data for recent deployments
  // In a real application, this would come from an API or state management
  const recentDeployments = [
    {
      id: "DEP-001",
      name: "Microsoft Office 365",
      date: "2023-04-05",
      status: "Completed",
    },
    {
      id: "DEP-002",
      name: "Adobe Creative Cloud",
      date: "2023-04-04",
      status: "In Progress",
    },
    {
      id: "DEP-003",
      name: "Google Chrome",
      date: "2023-04-03",
      status: "Completed",
    },
    {
      id: "DEP-004",
      name: "Zoom Client",
      date: "2023-04-02",
      status: "Failed",
    },
    {
      id: "DEP-005",
      name: "Slack",
      date: "2023-04-01",
      status: "Completed",
    },
  ]

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Application</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {recentDeployments.map((deployment) => (
          <TableRow key={deployment.id}>
            <TableCell className="font-medium">{deployment.id}</TableCell>
            <TableCell>{deployment.name}</TableCell>
            <TableCell>{deployment.date}</TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={
                  deployment.status === "Completed"
                    ? "border-green-500 text-green-500"
                    : deployment.status === "In Progress"
                      ? "border-blue-500 text-blue-500"
                      : "border-red-500 text-red-500"
                }
              >
                {deployment.status === "Completed" ? (
                  <CheckCircle className="mr-1 h-3 w-3" />
                ) : deployment.status === "In Progress" ? (
                  <Clock className="mr-1 h-3 w-3" />
                ) : (
                  <XCircle className="mr-1 h-3 w-3" />
                )}
                {deployment.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
