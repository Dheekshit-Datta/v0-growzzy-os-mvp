import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import dns from "dns/promises"
import { auth } from "@/lib/auth"
import { resolveUserId } from "@/lib/resolve-user"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const BodySchema = z.object({ url: z.string().url() })

const MAX_BYTES = 2 * 1024 * 1024
const FETCH_TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 3

const scrapeCache = new Map<string, { data: ScrapeResult; expiresAt: number }>()

type ScrapeResult = {
  url: string
  title: string | null
  description: string | null
  brandName: string | null
  headings: string[]
  ogImage: string | null
  priceHints: string[]
}

function isPrivateAddress(address: string): boolean {
  if (address === "::1" || address.startsWith("fe80:") || address.startsWith("fc") || address.startsWith("fd")) return true
  const parts = address.split(".").map(Number)
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false
  const [a, b] = parts
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 169 && b === 254) return true
  return false
}

async function assertPublicHost(url: URL): Promise<void> {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only http/https URLs are supported")
  const host = url.hostname.toLowerCase()
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("This host cannot be scraped")
  const looksLikeIp = /^[\d.]+$/.test(host) || host.includes(":")
  if (looksLikeIp && isPrivateAddress(host)) throw new Error("This host cannot be scraped")
  if (!looksLikeIp) {
    const records = await dns.lookup(host, { all: true }).catch(() => [])
    if (records.length === 0) throw new Error("Could not resolve host")
    for (const record of records) {
      if (isPrivateAddress(record.address)) throw new Error("This host cannot be scraped")
    }
  }
}

async function fetchWithLimits(startUrl: string): Promise<{ finalUrl: string; html: string }> {
  let currentUrl = startUrl
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = new URL(currentUrl)
    await assertPublicHost(url)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const response = await fetch(url.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "GrowzzyBot/1.0 (+https://growzzyos.vercel.app)", Accept: "text/html" },
      })
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location")
        if (!location) throw new Error("Redirect without location")
        currentUrl = new URL(location, url).toString()
        continue
      }
      if (!response.ok) throw new Error(`Site returned ${response.status}`)
      const reader = response.body?.getReader()
      if (!reader) throw new Error("Empty response")
      const chunks: Uint8Array[] = []
      let received = 0
      while (received < MAX_BYTES) {
        const { done, value } = await reader.read()
        if (done) break
        received += value.length
        chunks.push(value)
      }
      reader.cancel().catch(() => undefined)
      const html = Buffer.concat(chunks).toString("utf8")
      return { finalUrl: url.toString(), html }
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error("Too many redirects")
}

function extract(html: string, finalUrl: string): ScrapeResult {
  const pick = (re: RegExp) => {
    const m = html.match(re)
    return m?.[1] ? decodeEntities(m[1].trim()).slice(0, 300) : null
  }
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const description =
    pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    pick(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i) ||
    pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
  const ogImage = pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
  const brandName =
    pick(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i) ||
    (title ? title.split(/[|\-–—]/)[0].trim().slice(0, 80) : null)

  const headings: string[] = []
  const headingRe = /<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi
  let match: RegExpExecArray | null
  while ((match = headingRe.exec(html)) && headings.length < 8) {
    const text = decodeEntities(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    if (text && text.length > 2) headings.push(text.slice(0, 160))
  }

  const priceHints: string[] = []
  const priceRe = /(?:\$|₹|€|£)\s?\d[\d,]*(?:\.\d{1,2})?(?:\s?\/\s?(?:mo|month|year|yr))?/g
  const bodyText = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "")
  let priceMatch: RegExpExecArray | null
  while ((priceMatch = priceRe.exec(bodyText)) && priceHints.length < 5) {
    priceHints.push(priceMatch[0].replace(/\s+/g, ""))
  }

  return { url: finalUrl, title, description, brandName, headings, ogImage, priceHints }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)

  const limit = await rateLimit(`scrape-site:${userId}`, 20, 60_000)
  if (!limit.allowed) return NextResponse.json({ ok: false, error: "Too many scrape requests — try again shortly" }, { status: 429 })

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ ok: false, error: "A valid URL is required" }, { status: 400 })

  const cacheKey = parsed.data.url
  const cached = scrapeCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ ok: true, data: cached.data, cached: true })
  }

  try {
    const { finalUrl, html } = await fetchWithLimits(parsed.data.url)
    const data = extract(html, finalUrl)
    scrapeCache.set(cacheKey, { data, expiresAt: Date.now() + 24 * 60 * 60 * 1000 })
    return NextResponse.json({ ok: true, data })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Could not read the site", degraded: true },
      { status: 422 }
    )
  }
}
