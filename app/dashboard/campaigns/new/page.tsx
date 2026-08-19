"use client";

import { useSearchParams } from "next/navigation";
import { Shell } from "@/components/dashboard-v2/shell";
import { AgentChat } from "@/components/growzzy/agent-chat";

export default function NewCampaignPage() {
  const searchParams = useSearchParams();
  const threadId = searchParams.get("threadId") || searchParams.get("reuse") || "growzzy-agent";

  return (
    <Shell>
      <div className="h-[calc(100vh-56px)] flex flex-col bg-background overflow-hidden">
        <AgentChat threadId={threadId} />
      </div>
    </Shell>
  );
}
