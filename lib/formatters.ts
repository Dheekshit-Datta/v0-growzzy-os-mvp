export function formatCurrency(value: number | null | undefined, decimals = 2): string {
  if (!Number.isFinite(Number(value))) return "$0.00"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(value))
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (!Number.isFinite(Number(value))) return "0"
  return new Intl.NumberFormat("en-US").format(Number(value))
}

export function formatPercent(value: number | null | undefined, decimals = 2): string {
  if (!Number.isFinite(Number(value))) return "0.00%"
  return `${Number(value).toFixed(decimals)}%`
}

export function formatRoas(value: number | null | undefined, decimals = 1): string {
  if (!Number.isFinite(Number(value))) return "0.0x"
  return `${Number(value).toFixed(decimals)}x`
}

export function formatDateLabel(value: string | Date | null | undefined): string {
  if (!value) return "Never"
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return "Never"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function formatRelativeTime(value: string | Date | null | undefined): string {
  if (!value) return "Never synced"
  const date = value instanceof Date ? value : new Date(value)
  const diffMs = Date.now() - date.getTime()
  if (!Number.isFinite(diffMs) || Number.isNaN(diffMs)) return "Never synced"
  if (diffMs < 60_000) return "Just now"
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? "" : "s"} ago`
}

