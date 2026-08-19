"use client"

import { AgentChat } from "@/components/growzzy/agent-chat"
import { Shell } from "@/components/dashboard-v2/shell"

export default function NewCampaignPage() {
  return (
    <Shell>
      <div className="w-full">
        <AgentChat threadId="growzzy-new-campaign" />
      </div>
    </Shell>
  )
}