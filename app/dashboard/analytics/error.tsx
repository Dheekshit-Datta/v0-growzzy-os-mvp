"use client"

import { Button } from "@/components/ui/button"

export default function AnalyticsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <h2 className="mb-2 text-lg font-semibold">Analytics failed to load</h2>
        <p className="mb-4 text-sm text-slate-500">The data view hit an error. Retry should recover it.</p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  )
}
