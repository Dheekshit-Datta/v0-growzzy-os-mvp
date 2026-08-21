"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function CampaignsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Growzzy] Campaigns error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-foreground">Something went wrong</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {error?.message || "An unexpected error occurred while loading this page."}
        </p>
        <div className="flex justify-center gap-3">
          <Button onClick={() => reset()} className="cursor-pointer">
            Try again
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="cursor-pointer"
          >
            Reload page
          </Button>
        </div>
      </div>
    </div>
  );
}
