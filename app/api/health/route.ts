import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const checks = {
    status: "healthy" as "healthy" | "degraded",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "unknown",
    checks: {
      database: "unknown",
      openai: "unknown",
    },
  }

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.checks.database = "healthy"
  } catch {
    checks.checks.database = "unhealthy"
    checks.status = "degraded"
  }

  checks.checks.openai = process.env.OPENAI_API_KEY ? "configured" : "missing"
  if (!process.env.OPENAI_API_KEY) checks.status = "degraded"

  return NextResponse.json(checks, { status: checks.status === "healthy" ? 200 : 503 })
}
