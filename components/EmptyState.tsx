"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

type EmptyStateProps = {
  icon: React.ReactNode
  title: string
  description: string
  action?: { label: string; href?: string; onClick?: () => void }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/80 bg-white/55 px-8 py-14 text-center shadow-sm">
      <div className="mb-4 text-slate-400">{icon}</div>
      <h3 className="mb-2 text-lg font-semibold text-slate-950">{title}</h3>
      <p className="mb-6 max-w-sm text-sm text-slate-500">{description}</p>
      {action?.href ? (
        <Link href={action.href}>
          <Button>{action.label}</Button>
        </Link>
      ) : action ? (
        <Button onClick={action.onClick}>{action.label}</Button>
      ) : null}
    </div>
  )
}
