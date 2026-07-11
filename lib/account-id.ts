export function normalizeAccountId(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^act_/, "")
    .replace(/[-\s]/g, "")
}

export function accountIdVariants(value?: string | null) {
  const raw = String(value || "").trim()
  const normalized = normalizeAccountId(raw)
  if (!raw && !normalized) return []
  const variants = new Set<string>()
  if (raw) variants.add(raw)
  if (normalized) {
    variants.add(normalized)
    variants.add(`act_${normalized}`)
  }
  return Array.from(variants)
}

