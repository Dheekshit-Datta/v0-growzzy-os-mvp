import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { REPORT_TEMPLATES } from "@/lib/report-template-renderer"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  return NextResponse.json({
    ok: true,
    templates: REPORT_TEMPLATES.map(({ id, name, description }) => ({ id, name, description })),
  })
}

