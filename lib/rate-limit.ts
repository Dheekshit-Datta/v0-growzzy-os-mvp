const localStore = new Map<string, number[]>()

export type RateLimitResult = {
  allowed: boolean
  retryAfter: number
  unavailable?: boolean
  scope?: "burst" | "day" | "month"
}

export type RateLimitOptions = {
  strict?: boolean
}

export const RATE_LIMIT_POLICIES = {
  aiUtility: { burst: [20, 60_000], day: 100, month: 1_000 },
  campaignPlan: { burst: [5, 60_000], day: 20, month: 200 },
  creativeText: { burst: [10, 60_000], day: 20, month: 200 },
  imageGeneration: { burst: [3, 60_000], day: 10, month: 100 },
  platformSync: { burst: [3, 5 * 60_000], day: 24, month: 500 },
  campaignLaunch: { burst: [2, 60_000], day: 5, month: 50 },
  optimizationMutation: { burst: [10, 60_000], day: 50, month: 500 },
} as const

export type RateLimitPolicy = keyof typeof RATE_LIMIT_POLICIES

const SLIDING_WINDOW_SCRIPT = `
redis.call("ZREMRANGEBYSCORE", KEYS[1], 0, ARGV[2])
local count = redis.call("ZCARD", KEYS[1])
if count >= tonumber(ARGV[4]) then
  local oldest = redis.call("ZRANGE", KEYS[1], 0, 0, "WITHSCORES")
  local retry = tonumber(ARGV[3])
  if oldest[2] then retry = math.max(1, tonumber(oldest[2]) + tonumber(ARGV[3]) - tonumber(ARGV[1])) end
  return {0, retry}
end
redis.call("ZADD", KEYS[1], ARGV[1], ARGV[5])
redis.call("PEXPIRE", KEYS[1], ARGV[3])
return {1, 0}
`

function localRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const recent = (localStore.get(key) || []).filter((timestamp) => timestamp > now - windowMs)
  if (recent.length >= limit) {
    localStore.set(key, recent)
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) }
  }
  recent.push(now)
  localStore.set(key, recent)
  return { allowed: true, retryAfter: 0 }
}

export async function rateLimit(key: string, limit: number, windowMs: number, options: RateLimitOptions = {}): Promise<RateLimitResult> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!redisUrl || !redisToken) {
    if (options.strict) return { allowed: false, retryAfter: 60, unavailable: true }
    return localRateLimit(key, limit, windowMs)
  }

  const now = Date.now()
  const redisKey = `growzzy:rate-limit:${key}`
  try {
    const response = await fetch(redisUrl.replace(/\/$/, ""), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "EVAL",
        SLIDING_WINDOW_SCRIPT,
        "1",
        redisKey,
        String(now),
        String(now - windowMs),
        String(windowMs),
        String(limit),
        `${now}:${crypto.randomUUID()}`,
      ]),
      cache: "no-store",
    })
    if (!response.ok) throw new Error("Rate limit storage request failed")
    const payload = await response.json()
    const result = payload?.result
    if (!Array.isArray(result)) throw new Error("Invalid rate limit response")
    return {
      allowed: Number(result[0]) === 1,
      retryAfter: Math.max(0, Math.ceil(Number(result[1] || 0) / 1000)),
    }
  } catch {
    if (options.strict) return { allowed: false, retryAfter: 60, unavailable: true }
    return localRateLimit(key, limit, windowMs)
  }
}

export async function rateLimitPolicy(subject: string, policyName: RateLimitPolicy): Promise<RateLimitResult> {
  const policy = RATE_LIMIT_POLICIES[policyName]
  const windows = [
    { scope: "burst" as const, limit: policy.burst[0], windowMs: policy.burst[1] },
    { scope: "day" as const, limit: policy.day, windowMs: 24 * 60 * 60_000 },
    { scope: "month" as const, limit: policy.month, windowMs: 30 * 24 * 60 * 60_000 },
  ]

  for (const window of windows) {
    const result = await rateLimit(`${policyName}:${window.scope}:${subject}`, window.limit, window.windowMs, { strict: true })
    if (!result.allowed) return { ...result, scope: window.scope }
  }
  return { allowed: true, retryAfter: 0 }
}

export function rateLimitError(result: RateLimitResult) {
  return {
    body: {
      ok: false,
      error: {
        code: result.unavailable ? "RATE_LIMIT_UNAVAILABLE" : "RATE_LIMITED",
        message: result.unavailable
          ? "Request protection is temporarily unavailable. Please try again shortly."
          : `Usage limit reached${result.scope ? ` for this ${result.scope}` : ""}. Please try again later.`,
      },
    },
    status: result.unavailable ? 503 : 429,
    headers: { "Retry-After": String(Math.max(1, result.retryAfter)) },
  }
}

export function rateLimitResponse(result: RateLimitResult) {
  const error = rateLimitError(result)
  return Response.json(error.body, { status: error.status, headers: error.headers })
}
