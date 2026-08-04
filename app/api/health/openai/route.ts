import { NextResponse } from "next/server"
import OpenAI from "openai"
import { aiErrorMetadata, aiUnavailableMessage, UTILITY_MODEL } from "@/lib/ai-utility"

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
    const openai = new OpenAI({ apiKey, timeout: 5000 })
    const completion = await openai.chat.completions.create({
      model: UTILITY_MODEL,
      messages: [{ role: "user", content: "Return this JSON exactly: {\"ok\":true}" }],
      response_format: { type: "json_object" },
    })
    const latencyMs = Date.now() - start

    if (completion.choices[0]?.message?.content) {
      return NextResponse.json({
        status: "ok",
        model: UTILITY_MODEL,
        latencyMs,
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json(
      {
        status: "error",
        detail: "OpenAI chat generation returned an empty response.",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  } catch (err: any) {
    const meta = aiErrorMetadata(err)
    return NextResponse.json(
      {
        status: "error",
        detail: aiUnavailableMessage(err),
        openai: meta,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}
