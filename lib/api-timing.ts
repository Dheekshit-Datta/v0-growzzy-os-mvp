export function logSlowApi(route: string, startedAtMs: number, extra?: Record<string, unknown>) {
  const durationMs = Date.now() - startedAtMs
  if (durationMs > 1500) {
    console.warn(`[api-slow] ${route} took ${durationMs}ms`, extra || {})
  }
}

