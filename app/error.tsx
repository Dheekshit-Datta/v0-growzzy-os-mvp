"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { log } from "@/lib/logger"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    log("error", "global-error-boundary", "Global client error", { message: error.message, digest: error.digest })
  }, [error])

  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
          <div className="max-w-md text-center">
            <h2 className="mb-2 text-xl font-semibold">Something went wrong</h2>
            <p className="mb-6 text-sm text-slate-500">
              {process.env.NODE_ENV === "development" ? error.message : "An unexpected error occurred. Our team has been notified."}
            </p>
            <div className="flex justify-center gap-3">
              <Button onClick={reset}>Try again</Button>
              <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
