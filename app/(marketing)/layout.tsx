import type { ReactNode } from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "GrowzzyOS - AI-Powered Ad Management Platform",
  description:
    "Manage Meta and Google campaigns with real-time analytics, AI optimization and forensic alerts.",
}

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <div className="marketing-theme">{children}</div>
}
