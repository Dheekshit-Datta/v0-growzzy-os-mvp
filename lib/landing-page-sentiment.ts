/**
 * Landing Page Sentiment Analysis
 *
 * Fetches and analyzes the tone of a landing page URL to validate
 * that it aligns with the campaign's psychological framing.
 *
 * If the landing page is discouraging (e.g., "sign up for a 3-hour waitlist",
 * "our service is currently down"), the brief validation warns before the
 * campaign goes live.
 */

import { createHash } from "node:crypto"
import OpenAI from "openai"
import { aiErrorMetadata } from "./ai-utility"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })

export type LandingPageSentiment = {
  tone: "encouraging" | "discouraging" | "neutral"
  score: number // -100 to +100
  summary: string
  concerns: string[]
  url: string
  analyzed: boolean
}

/**
 * Analyze the sentiment of a landing page URL.
 * Uses OpenAI for classification; falls back to heuristic analysis if API unavailable.
 * Results are cached per-URL hash for 1 hour.
 */
export async function analyzeLandingPageSentiment(
  url: string,
  offer?: string
): Promise<LandingPageSentiment> {
  if (!url) return { tone: "neutral", score: 0, summary: "No URL provided", concerns: [], url, analyzed: false }

  const cacheKey = `lps:${createHash("sha256").update(url).digest("hex").slice(0, 16)}`
  // Simple in-memory cache (production: Redis)
  const cache = (global as any).__lpsCache = (global as any).__lpsCache || {}
  const cached = (cache as Record<string, { data: LandingPageSentiment; ts: number }>)[cacheKey]
  if (cached && Date.now() - cached.ts < 3600 * 1000) return cached.data

  const text = await fetchLandingPageText(url)
  if (!text || text.length < 50) {
    const result: LandingPageSentiment = {
      tone: "neutral",
      score: 0,
      summary: "Could not fetch landing page content",
      concerns: ["Landing page content could not be retrieved. Verify the URL is publicly accessible."],
      url,
      analyzed: true,
    }
    cache[cacheKey] = { data: result, ts: Date.now() }
    return result
  }

  // Truncate text to first 2000 chars to save tokens
  const truncated = text.slice(0, 2000)

  let result: LandingPageSentiment

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an expert landing page conversion analyst. Analyze the text content of a landing page and classify its tone as "encouraging", "discouraging", or "neutral".

Rules:
- "encouraging": page clearly communicates benefits, clear value prop, easy next step, trust signals, no friction
- "discouraging": page has long waitlists, "service unavailable", complex sign-up, no pricing, broken CTAs, excessive forms, vague value prop, fear/uncertainty/doubt messaging
- "neutral": mixed signals or generic page with no strong positive/negative conversion signals

Return ONLY valid JSON:
{
  "tone": "encouraging|discouraging|neutral",
  "score": -100 to 100 (how strongly encouraging or discouraging),
  "summary": "2-3 sentence summary of the landing page's conversion tone",
  "concerns": ["list of specific conversion concerns if any"]
}`,
        },
        {
          role: "user",
          content: `Analyze this landing page${offer ? ` for a campaign selling: ${offer}` : ""}:\n\n${truncated}`,
        },
      ],
    })

    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}")
    result = {
      tone: normalizeTone(parsed.tone),
      score: Math.max(-100, Math.min(100, Number(parsed.score) || 0)),
      summary: String(parsed.summary || "Analysis complete").slice(0, 300),
      concerns: Array.isArray(parsed.concerns) ? parsed.concerns.slice(0, 5).map(String) : [],
      url,
      analyzed: true,
    }
  } catch (error) {
    // Fallback: heuristic analysis without OpenAI
    result = heuristicSentiment(text, url)
    try {
      const meta = aiErrorMetadata(error)
      console.warn("[landing-page-sentiment] OpenAI analysis failed, using heuristic fallback", meta)
    } catch {
      console.warn("[landing-page-sentiment] OpenAI analysis failed, using heuristic fallback")
    }
  }

  cache[cacheKey] = { data: result, ts: Date.now() }
  return result
}

function normalizeTone(t: unknown): LandingPageSentiment["tone"] {
  const s = String(t || "").toLowerCase()
  if (s.includes("encourag")) return "encouraging"
  if (s.includes("discourag")) return "discouraging"
  return "neutral"
}

/**
 * Lightweight heuristic fallback when OpenAI is unavailable.
 * Checks for common discouraging/encouraging patterns.
 */
function heuristicSentiment(text: string, url: string): LandingPageSentiment {
  const lower = text.toLowerCase()
  let score = 0
  const concerns: string[] = []

  // Discouraging signals
  const discouragers = [
    { pattern: /waitlist|join the queue|coming soon/i, weight: -15, reason: "Waitlist or 'coming soon' creates friction" },
    { pattern: /currently unavailable|service down|maintenance/i, weight: -30, reason: "Page indicates service is unavailable" },
    { pattern: /sign up for (a )?free trial (and well|but|i will)/i, weight: -10, reason: "Hidden commitment in free trial offer" },
    { pattern: /enter (your |)email.{0,30}(to|for)/i, weight: -8, reason: "Email gate creates friction before value delivery" },
    { pattern: /credit card|pay (up )?front|commitment required/i, weight: -10, reason: "Payment required upfront before trying" },
    { pattern: /no refunds|no guarantee|all sales final/i, weight: -15, reason: "No refund policy increases perceived risk" },
    { pattern: /complex|confusing|difficult/i, weight: -8, reason: "Page language suggests complexity" },
    { pattern: /contact sales|talk to (a )?sales.{0,20}(to|for|before)/i, weight: -12, reason: "Sales gate blocks self-service conversion" },
    { pattern: /no pricing|pricing unavailable|call for (price|quote)/i, weight: -10, reason: "No pricing info creates uncertainty" },
    { pattern: /fill out.{0,20}form.{0,30}(before|to receive)/i, weight: -8, reason: "Long form creates friction" },
    { pattern: /download (our|the) app/i, weight: -5, reason: "App download requirement adds friction" },
  ]

  // Encouraging signals
  const encouragers = [
    { pattern: /free (trial|consultation|audit|assessment|demo)/i, weight: 15, reason: "Risk-reversal free offer" },
    { pattern: /no credit card|credit card not required/i, weight: 12, reason: "No payment commitment lowers barrier" },
    { pattern: /get started (in|for).{0,20}(minutes?|hours?|seconds?)/i, weight: 10, reason: "Fast activation signal" },
    { pattern: /guarantee|refund|money back/i, weight: 12, reason: "Risk reversal reduces purchase anxiety" },
    { pattern: /trusted by|used by|customers|clients.{0,20}\d+/i, weight: 10, reason: "Social proof signals trust" },
    { pattern: /(\d+)\+ (business|companies|users|customers)/i, weight: 8, reason: "Scale proof (user count)" },
    { pattern: /4\.\d|rating|stars|reviews?/i, weight: 8, reason: "Rating/review signal" },
    { pattern: /easy|simple|no code|setup.{0,20}minutes/i, weight: 8, reason: "Ease-of-use signal" },
    { pattern: /cancel anytime|no commitment/i, weight: 10, reason: "Flexibility reduces churn fear" },
    { pattern: /24\/7|live |human support|chat/i, weight: 6, reason: "Support availability signal" },
  ]

  for (const d of discouragers) {
    if (d.pattern.test(lower)) { score += d.weight; concerns.push(d.reason) }
  }
  for (const e of encouragers) {
    if (e.pattern.test(lower)) { score += e.weight }
  }

  const tone: LandingPageSentiment["tone"] = score > 10 ? "encouraging" : score < -10 ? "discouraging" : "neutral"
  return {
    tone,
    score: Math.max(-100, Math.min(100, score)),
    summary: `Heuristic analysis of ${url}: ${tone} tone (score ${score}). ${concerns.length > 0 ? "Concerns: " + concerns.join("; ") : "No significant concerns detected."}`,
    concerns,
    url,
    analyzed: true,
  }
}

async function fetchLandingPageText(pageUrl: string): Promise<string> {
  try {
    const urlObj = new URL(pageUrl)
    if (!urlObj.protocol.startsWith("http")) return ""
    // Basic SSRF check (reuse from business-context)
    if (urlObj.hostname === "localhost" || urlObj.hostname === "127.0.0.1") return ""
    if (/^10\.\d+\.\d+\.\d+$/.test(urlObj.hostname)) return ""
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(urlObj.hostname)) return ""
    if (/^192\.168\./.test(urlObj.hostname)) return ""
    if (urlObj.hostname.endsWith(".local")) return ""

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(pageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GrowzzyOS/1.0)" },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) return ""
    const ct = res.headers.get("content-type") || ""
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) return ""
    const html = await res.text()
    if (html.length > 512 * 1024) return ""
    return extractTextFromHtml(html)
  } catch {
    return ""
  }
}

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
