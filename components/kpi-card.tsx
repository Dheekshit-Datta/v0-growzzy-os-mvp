import { ArrowDown, ArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  label: string
  value: string
  delta?: number
  inverse?: boolean
  hint?: string
}

export function KpiCard({ label, value, delta = 0, inverse = false, hint }: Props) {
  const positive = inverse ? delta < 0 : delta >= 0
  const Icon = delta >= 0 ? ArrowUp : ArrowDown

  return (
    <div className="rounded-lg border bg-card p-5 transition-colors hover:border-primary/30">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <div className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">{value}</div>
        <div className={cn("flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium", positive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>
          <Icon className="h-3 w-3" />
          {Math.abs(delta).toFixed(1)}%
        </div>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{hint ?? "vs. previous 30 days"}</div>
    </div>
  )
}
