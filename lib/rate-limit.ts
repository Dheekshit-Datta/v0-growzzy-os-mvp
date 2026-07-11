const store = new Map<string, { count: number; resetAt: number }>()

export type RateLimitResult = {
  allowed: boolean
  retryAfter: number
  unavailable?: boolean
}

export type RateLimitOptions = {
  strict?: boolean
}

function localRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const existing = store.get(key)

  if (!existing || now > existing.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfter: 0 }
  }

  if (existing.count >= limit) {
    return { allowed: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) }
  }

  existing.count += 1
  return { allowed: true, retryAfter: 0 }
}

export async function rateLimit(key: string, limit: number, windowMs: number, options: RateLimitOptions = {}): Promise<RateLimitResult> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!redisUrl || !redisToken) {
    if (options.strict) return { allowed: false, retryAfter: Math.ceil(windowMs / 1000), unavailable: true }
    return localRateLimit(key, limit, windowMs)
  }

  const bucket = `growzzy:rate-limit:${key}:${Math.floor(Date.now() / windowMs)}`
  try {
    const response = await fetch(`${redisUrl.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([["INCR", bucket], ["PEXPIRE", bucket, String(windowMs), "NX"]]),
      cache: "no-store",
    })
    if (!response.ok) throw new Error("Rate limit storage request failed")
    const result = await response.json()
    const count = Number(result?.[0]?.result || 0)
    return {
      allowed: count <= limit,
      retryAfter: count <= limit ? 0 : Math.ceil(windowMs / 1000),
    }
  } catch {
    if (options.strict) return { allowed: false, retryAfter: Math.ceil(windowMs / 1000), unavailable: true }
    return localRateLimit(key, limit, windowMs)
  }
}
