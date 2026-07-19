"use client"

import { useState } from "react"
import { Sidebar } from "./sidebar"
import { TopBar } from "./top-bar"
import { BetaFeedbackWidget } from "@/components/BetaFeedbackWidget"

interface ShellProps {
  children: React.ReactNode
  title?: string
}

export function Shell({ children, title }: ShellProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen bg-[#F6F7F9] overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar title={title} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      <BetaFeedbackWidget />
    </div>
  )
}
