import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const maxDuration = 10

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { status: "error", detail: "DATABASE_URL is not configured." },
      { status: 503 }
    )
  }

  try {
    const start = Date.now()
    await Promise.race([
      prisma.$queryRaw`SELECT 1 as connected`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Connection timeout (5s)")), 5000)
      ),
    ])
    const latencyMs = Date.now() - start

    return NextResponse.json({
      status: "ok",
      latencyMs,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        detail: err.message.includes("timeout")
          ? "Database connection timed out. Verify the managed PostgreSQL database is available."
          : `Cannot reach database: ${err.message}`,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}
