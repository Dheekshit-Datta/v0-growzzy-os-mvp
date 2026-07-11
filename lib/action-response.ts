import { randomUUID } from "crypto"

export function createCorrelationId() {
  return randomUUID()
}

export function asErrorCode(input: string) {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64)
}

export function classifyActionError(message: string) {
  const text = String(message || "").toLowerCase()
  if (text.includes("stale")) return "STALE_DATA_BLOCK"
  if (text.includes("token") || text.includes("oauth") || text.includes("reconnect")) return "AUTH_REQUIRED"
  if (text.includes("scope") || text.includes("permission") || text.includes("preflight")) return "PREFLIGHT_BLOCK"
  if (text.includes("workspace") || text.includes("account") || text.includes("not found")) return "SCOPE_MISMATCH"
  if (text.includes("budget")) return "BUDGET_MUTATION_FAILED"
  if (text.includes("campaign")) return "CAMPAIGN_MUTATION_FAILED"
  return "PROVIDER_MUTATION_FAILED"
}

export function parseActionErrorDetails(message: string) {
  const raw = String(message || "")
  const [providerMessage, remediationTail] = raw.split("Remediation:")
  const remediation = remediationTail?.trim() || null
  return {
    providerMessage: providerMessage?.trim() || raw,
    remediation,
    code: classifyActionError(raw),
  }
}
