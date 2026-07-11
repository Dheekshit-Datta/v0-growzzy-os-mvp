import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { ReportBuilder, type ReportConfig } from "@/lib/report-builder"
import { getRequestWorkspaceId, workspaceWhere } from "@/lib/workspace"

export const dynamic = "force-dynamic"

async function getReportForUser(id: string, req: Request) {
  const session = await auth()
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const userId = await resolveUserId(session.user.id)
  const workspaceId = await getRequestWorkspaceId(userId, req as any)
  const report = await prisma.report.findFirst({ where: { id, userId, ...workspaceWhere(workspaceId, false) } })
  if (!report) return { error: NextResponse.json({ error: "Report not found" }, { status: 404 }) }
  return { report }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await getReportForUser(params.id, _req)
    if (result.error) return result.error
    return NextResponse.json(result.report)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch report" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await getReportForUser(params.id, _req)
    if (result.error) return result.error
    const session = await auth()
    const userId = await resolveUserId(session!.user!.id!)
    const workspaceId = await getRequestWorkspaceId(userId, _req as any)
    await prisma.report.delete({ where: { id: params.id, userId, ...workspaceWhere(workspaceId, false) } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete report" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { action } = await req.json()
    if (action !== "download-pdf") return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    const result = await getReportForUser(params.id, req)
    if (result.error) return result.error
    const report = result.report

    const metrics = (report.metrics as any) || {}
    const insights = report.insights as any
    const reportConfig: ReportConfig = {
      title: report.name,
      includeMetrics: true,
      includePlatformBreakdown: true,
      includeTopCampaigns: true,
      includeInsights: true,
      includeRecommendations: true,
      includeAIAnalysis: report.type === "ai_analysis",
    }

    const builder = new ReportBuilder(reportConfig, {
      totalSpend: metrics.totalSpend || 0,
      totalRevenue: metrics.totalRevenue || 0,
      roas: Number(metrics.roas || 0).toFixed(2),
      ctr: Number(metrics.ctr || 0).toFixed(2),
      cpc: Number(metrics.cpc || 0).toFixed(2),
      conversions: metrics.totalConversions || 0,
      campaigns: metrics.campaigns || [],
      leads: [],
      platformBreakdown: metrics.platformBreakdown || {},
      insights: (insights || report.insights || undefined) as any,
      recommendations: report.recommendations as any,
      psychologicalInsights: insights?.psychologicalInsights || [],
    })

    const pdfBuffer = Buffer.from(builder.build().output("arraybuffer"))
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${report.name.replace(/\s+/g, "_")}.pdf"`,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to generate PDF" }, { status: 500 })
  }
}
