"use client"

import { Button } from "@/components/ui/button"

export default function CampaignsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <h2 className="mb-2 text-lg font-semibold">Campaigns failed to load</h2>
        <p className="mb-4 text-sm text-slate-500">Try again and we'll refetch the table.</p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  )
}
