import { redirect } from "next/navigation"

export default function CampaignLauncherRedirectPage() {
  redirect("/dashboard/campaigns/new")
}

