import { cn } from "@/lib/utils"

export function StatusBadge({ status }: { status?: string | null }) {
  const normalized = (status || "DRAFT").toUpperCase()
  const active = normalized === "ACTIVE" || normalized === "ENABLED"
  const paused = normalized === "PAUSED"
  const archived = normalized === "ARCHIVED" || normalized === "REMOVED"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        active && "border-emerald-200 bg-emerald-50 text-emerald-700",
        paused && "border-amber-200 bg-amber-50 text-amber-700",
        archived && "border-slate-200 bg-slate-100 text-slate-500",
        !active && !paused && !archived && "border-blue-200 bg-blue-50 text-blue-700"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", active && "bg-emerald-500", paused && "bg-amber-500", archived && "bg-slate-400", !active && !paused && !archived && "bg-blue-500")} />
      {normalized}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: "HIGH" | "MEDIUM" | "LOW" | string }) {
  const normalized = String(priority).toUpperCase()
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        normalized === "HIGH" && "border-red-200 bg-red-50 text-red-700",
        normalized === "MEDIUM" && "border-amber-200 bg-amber-50 text-amber-700",
        normalized !== "HIGH" && normalized !== "MEDIUM" && "border-blue-200 bg-blue-50 text-blue-700"
      )}
    >
      {normalized}
    </span>
  )
}
