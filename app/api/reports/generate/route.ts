import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { normalizeReportType, renderReportHtml, type ReportDateRange } from "@/lib/report-template-renderer"
import { getRequestWorkspaceId } from "@/lib/workspace"

export const dynamic = "force-dynamic"

async function getUser(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return null
  const userId = await resolveUserId(session.user.id)
  return {
    id: userId,
    accountName: session.user.name || session.user.email || "Growzzy Account",
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const type = normalizeReportType(searchParams.get("type"))
    const workspaceId = await getRequestWorkspaceId(user.id, req)
    const adAccountId = searchParams.get("adAccountId")
    const dateRange: ReportDateRange = {
      start: searchParams.get("start") || undefined,
      end: searchParams.get("end") || undefined,
    }

    const rendered = await renderReportHtml({
      userId: user.id,
      accountName: user.accountName,
      type,
      workspaceId,
      adAccountId,
      dateRange,
    })

    return NextResponse.json({
      ok: true,
      type,
      generatedAt: new Date().toISOString(),
      html: rendered.html,
      data: rendered.data,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to render report" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const type = normalizeReportType(body?.type)
    const workspaceId = await getRequestWorkspaceId(user.id, req)
    const adAccountId = typeof body?.adAccountId === "string" ? body.adAccountId : null
    const dateRange: ReportDateRange = body?.dateRange || {}
    const startDate = dateRange.start ? new Date(dateRange.start) : new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)
    const endDate = dateRange.end ? new Date(dateRange.end) : new Date()

    const rendered = await renderReportHtml({
      userId: user.id,
      accountName: user.accountName,
      type,
      workspaceId,
      adAccountId,
      dateRange,
    })

    if (!rendered.data.hasCampaignData) {
      return NextResponse.json(
        {
          ok: false,
          code: "NO_VERIFIED_REPORT_DATA",
          error: "No verified synced campaign data yet. Sync a connected Google Ads account before generating reports.",
          html: rendered.html,
          data: rendered.data,
        },
        { status: 409 }
      )
    }

    const report = await prisma.report.create({
      data: {
        userId: user.id,
        workspaceId,
        adAccountId,
        type,
        name: `${type.replace(/-/g, " ")} - ${new Date().toISOString().slice(0, 10)}`,
        format: "html",
        status: "completed",
        startDate,
        endDate,
        platforms: [
          rendered.data.googleConnected ? "GOOGLE" : null,
          rendered.data.metaConnected ? "META" : null,
        ].filter(Boolean) as string[],
        aiSummary: String(rendered.data.executiveSummary || ""),
        data: {
          templateType: type,
          html: rendered.html,
        },
        metrics: rendered.data as any,
        recommendations: rendered.data.recommendations as any,
        lastRunAt: new Date(),
      },
    })

    return NextResponse.json({
      ok: true,
      type,
      reportId: report.id,
      generatedAt: new Date().toISOString(),
      html: rendered.html,
      data: rendered.data,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to generate report" }, { status: 500 })
  }
}
