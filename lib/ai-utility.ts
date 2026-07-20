import { createHash } from "node:crypto"
import OpenAI from "openai"
import { log } from "@/lib/logger"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })
const CACHE_TTL_SECONDS = 24 * 60 * 60

type UtilityCall = {
  route: string
  operation: string
  userId: string
  workspaceId: string
  input: unknown
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  json?: boolean
}

export function utilityCacheKey(operation: string, workspaceId: string, input: unknown) {
  const digest = createHash("sha256").update(JSON.stringify({ operation, workspaceId, input })).digest("hex")
  return `growzzy:ai-cache:${operation}:${digest}`
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
  const model = process.env.OPENAI_UTILITY_MODEL || "gpt-5-mini"
  const key = utilityCacheKey(call.operation, call.workspaceId, call.input)

  try {
    const cached = await redis(["GET", key])
    if (typeof cached === "string") {
      log("info", "ai/usage", "AI utility completed", {
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

  const completion = await openai.chat.completions.create({
    model,
    messages: call.messages,
    ...(call.json ? { response_format: { type: "json_object" as const } } : {}),
  })
  const content = completion.choices[0]?.message?.content?.trim() || ""

  if (content) {
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
