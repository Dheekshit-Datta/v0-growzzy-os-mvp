export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { rateLimit } from "@/lib/rate-limit"
import { requestPassesSameOrigin } from "@/lib/request-origin"

export async function POST(req: Request) {
  if (!requestPassesSameOrigin(req)) {
    return NextResponse.json({ error: "Cross-origin mutation blocked." }, { status: 403 })
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"
  const limit = await rateLimit(`auth:register:${ip}`, 5, 60_000, { strict: true })
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many signup attempts. Please wait a moment." }, { status: 429 })
  }

  try {
    const { email, password, name } = await req.json()
    const normalizedEmail = String(email || "").toLowerCase().trim()
    const displayName = String(name || "").trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 })
    }
    if (displayName.length < 2 || String(password || "").length < 8) {
      return NextResponse.json({ error: "Enter your name and a password of at least 8 characters" }, { status: 400 })
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Authentication service is not configured" }, { status: 503 })
    }

    const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: supabaseKey },
      body: JSON.stringify({ email: normalizedEmail, password, data: { name: displayName } }),
      cache: "no-store",
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      const message = data?.msg?.toLowerCase().includes("already") || data?.error_code === "user_already_exists"
        ? "An account with this email already exists. Sign in instead?"
        : "Unable to create your account. Please check your details and try again."
      return NextResponse.json({ error: message }, { status: response.status === 422 ? 409 : response.status })
    }

    return NextResponse.json({ success: true, userId: data?.user?.id || null, requiresEmailConfirmation: !data?.session })
  } catch {
    return NextResponse.json({ error: "Unable to create your account right now. Please try again." }, { status: 500 })
  }
}
