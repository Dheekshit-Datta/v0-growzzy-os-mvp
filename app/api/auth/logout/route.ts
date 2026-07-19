import { NextResponse } from "next/server"
import { requestPassesSameOrigin } from "@/lib/request-origin"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  if (!requestPassesSameOrigin(req)) return NextResponse.json({ ok: false, error: { code: "CROSS_ORIGIN_MUTATION", message: "Cross-origin mutation blocked." } }, { status: 403 })
  return NextResponse.json({ success: true, message: "Logged out successfully" })
}
