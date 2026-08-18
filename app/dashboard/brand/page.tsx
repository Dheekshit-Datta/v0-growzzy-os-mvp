"use client"

import { useEffect, useState } from "react"
import { Shell } from "@/components/dashboard-v2/shell"

export default function BrandPage() {
  const [lovableUrl, setLovableUrl] = useState<string>("http://localhost:8080/brand")

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_LOVABLE_URL) {
      setLovableUrl(`${process.env.NEXT_PUBLIC_LOVABLE_URL.replace(/\/$/, "")}/brand`)
    }
  }, [])

  return (
    <Shell>
      <div className="w-full h-[calc(100vh-96px)] rounded-[16px] overflow-hidden border border-border bg-background shadow-xs">
        <iframe
          src={lovableUrl}
          title="Growzzy Brand Studio"
          className="w-full h-full border-0"
          allow="clipboard-read; clipboard-write; camera; microphone"
        />
      </div>
    </Shell>
  )
}