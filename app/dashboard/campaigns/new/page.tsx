"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Shell } from "@/components/dashboard-v2/shell";
import { AgentChat } from "@/components/growzzy/agent-chat";

function NewCampaignContent() {
  const searchParams = useSearchParams();
  const threadId = searchParams.get("threadId") || searchParams.get("reuse") || "growzzy-agent";

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col bg-background overflow-hidden">
      <AgentChat threadId={threadId} />
    </div>
  );
}

export default function NewCampaignPage() {
  return (
    <Shell>
      <Suspense fallback={<div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">Loading Growzzy Agent...</div>}>
        <NewCampaignContent />
      </Suspense>
    </Shell>
  );
}
