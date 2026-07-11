import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 10

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey || apiKey.includes("your_") || apiKey === "placeholder") {
    return NextResponse.json(
      { status: "error", detail: "OPENAI_API_KEY is not set or is a placeholder." },
      { status: 503 }
    )
  }

  try {
    const start = Date.now()
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    })
    const latencyMs = Date.now() - start

    if (res.ok) {
      return NextResponse.json({
        status: "ok",
        latencyMs,
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json(
      {
        status: "error",
        detail: `OpenAI returned HTTP ${res.status}. API key may be invalid or expired.`,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        detail: `OpenAI health check failed: ${err.message}`,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}
