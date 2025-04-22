/**
 * Redirect component for the Deployments page
 *
 * This component automatically redirects users from the /deployments path
 * to the Winget deployment page.
 */
import { redirect } from "next/navigation"

/**
 * Deployments page that redirects to the Winget deployment page
 */
export default function Deployments() {
  redirect("/deployments/winget")
}
