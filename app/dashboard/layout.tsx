import type React from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { AdsAccountGate } from "@/components/AdsAccountGate"

export const metadata = {
  title: "Dashboard | Growzzy OS",
}

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <AdsAccountGate>
        {children}
      </AdsAccountGate>
    </ProtectedRoute>
  )
}
