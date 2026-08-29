import { createHash } from "node:crypto"
import OpenAI from "openai"
import { log } from "@/lib/logger"
import { assertCreditsAvailable, estimatedCredits, recordCreditUsage } from "@/lib/ai-credits"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })
const CACHE_TTL_SECONDS = 24 * 60 * 60
export const UTILITY_MODEL = process.env.OPENAI_UTILITY_MODEL || "gpt-4o-mini"

type UtilityCall = {
  route: string
  operation: string
  userId: string
  workspaceId: string
  input: unknown
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  json?: boolean
}

export function aiErrorMetadata(error: unknown) {
  const value = error && typeof error === "object" ? error as Record<string, unknown> : {}
  return {
    status: typeof value.status === "number" ? value.status : null,
    code: typeof value.code === "string" ? value.code.slice(0, 80) : null,
    type: typeof value.type === "string" ? value.type.slice(0, 80) : error instanceof Error ? error.name : "UnknownError",
  }
}

export function aiUnavailableMessage(error?: unknown) {
  const meta = aiErrorMetadata(error)
  if (meta.status === 429 && meta.code === "insufficient_quota") {
    return "OpenAI quota is exhausted for this API key. Add billing/credits in OpenAI, then redeploy."
  }
  return "AI is temporarily unavailable. Your brief is safe; try again shortly."
}

export function utilityCacheKey(operation: string, workspaceId: string, input: unknown) {
  const digest = createHash("sha256").update(JSON.stringify({ operation, workspaceId, input })).digest("hex")
  return `growzzy:ai-cache:${operation}:${digest}`
}

const inMemoryCache = new Map<string, { value: string; expiresAt: number }>()

function getMemoryCache(key: string): string | null {
  const item = inMemoryCache.get(key)
  if (!item) return null
  if (Date.now() > item.expiresAt) {
    inMemoryCache.delete(key)
    return null
  }
  return item.value
}

function setMemoryCache(key: string, value: string, ttlSeconds: number) {
  if (inMemoryCache.size > 1000) {
    const firstKey = inMemoryCache.keys().next().value
    if (firstKey) inMemoryCache.delete(firstKey)
  }
  inMemoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
}

async function redis(command: string[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "")
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  })
  if (!response.ok) throw new Error("AI cache request failed")
  return (await response.json())?.result ?? null
}

export async function cachedUtilityCompletion(call: UtilityCall) {
  const startedAt = Date.now()
  let model = UTILITY_MODEL
  const key = utilityCacheKey(call.operation, call.workspaceId, call.input)

  // 1. Check in-memory cache first
  const memoryCached = getMemoryCache(key)
  if (typeof memoryCached === "string") {
    log("info", "ai/usage", "AI utility completed (in-memory cache)", {
      route: call.route,
      model,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: Date.now() - startedAt,
      cacheHit: true,
      userId: call.userId,
      workspaceId: call.workspaceId,
    })
    return memoryCached
  }

  // 2. Check Redis cache if available
  try {
    const cached = await redis(["GET", key])
    if (typeof cached === "string") {
      setMemoryCache(key, cached, CACHE_TTL_SECONDS)
      log("info", "ai/usage", "AI utility completed (redis cache)", {
        route: call.route,
        model,
        inputTokens: 0,
        outputTokens: 0,
        durationMs: Date.now() - startedAt,
        cacheHit: true,
        userId: call.userId,
        workspaceId: call.workspaceId,
      })
      return cached
    }
  } catch {
    // Cache is a cost optimization; route rate limits remain fail-closed separately.
  }

  let completion: OpenAI.Chat.Completions.ChatCompletion
  await assertCreditsAvailable(call.workspaceId, estimatedCredits(model))
  try {
    completion = await openai.chat.completions.create({
      model,
      messages: call.messages,
      ...(call.json ? { response_format: { type: "json_object" as const } } : {}),
    })
  } catch (error) {
    if (model === "gpt-4o-mini") throw error
    model = "gpt-4o-mini"
    completion = await openai.chat.completions.create({
      model,
      messages: call.messages,
      ...(call.json ? { response_format: { type: "json_object" as const } } : {}),
    })
  }
  const content = completion.choices[0]?.message?.content?.trim() || ""

  await recordCreditUsage({
    workspaceId: call.workspaceId,
    userId: call.userId,
    route: call.route,
    model,
    inputTokens: completion.usage?.prompt_tokens,
    outputTokens: completion.usage?.completion_tokens,
  })

  if (content) {
    setMemoryCache(key, content, CACHE_TTL_SECONDS)
    try {
      await redis(["SET", key, content, "EX", String(CACHE_TTL_SECONDS)])
    } catch {
      // A successful model response should not fail because the optional cache write failed.
    }
  }

  log("info", "ai/usage", "AI utility completed", {
    route: call.route,
    model,
    inputTokens: completion.usage?.prompt_tokens || 0,
    outputTokens: completion.usage?.completion_tokens || 0,
    durationMs: Date.now() - startedAt,
    cacheHit: false,
    userId: call.userId,
    workspaceId: call.workspaceId,
  })
  return content
}

