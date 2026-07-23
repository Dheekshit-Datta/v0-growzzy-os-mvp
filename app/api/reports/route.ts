import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateReportMetrics } from '@/lib/report-metrics'
import { generateAIInsights } from '@/lib/report-insights'
import { generateActionPlan } from '@/lib/report-action-plan'
import { getRequestWorkspaceId, workspaceWhere } from '@/lib/workspace'
import { resolveUserId } from '@/lib/resolve-user'
import { log } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// ============================================
// GET — List all reports
// ============================================
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 })
    }

    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, request)
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const integration = await prisma.integration.findFirst({
      where: { userId, workspaceId, status: { in: ["OAUTH_GRANTED", "ACCOUNT_SELECTED", "INITIAL_SYNC_RUNNING", "ACTIVE", "SYNC_FAILED"] }, hasAdsAccess: true },
      select: { selectedAdAccountId: true, accountId: true },
    })
    const adAccountId = integration?.selectedAdAccountId || integration?.accountId || null

    const where: any = { userId, ...workspaceWhere(workspaceId, false), ...(adAccountId ? { adAccountId } : { id: "__none__" }) }
    if (status) where.status = status

    const reports = await prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({ ok: true, data: { reports } })
  } catch (error: any) {
    log("error", "api/reports", "Failed to list scoped reports", { message: error?.message })
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL', message: error.message } }, { status: 500 })
  }
}

// ============================================
// POST — Create report + generate data + AI summary
// ============================================
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 })
    }

    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, request)
    const body = await request.json()
    const { name, type, startDate, endDate, schedule, config, adAccountId } = body

    if (!name || !type || !startDate || !endDate) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION', message: 'name, type, startDate, endDate are required' } }, { status: 400 })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    const metrics = await calculateReportMetrics(userId, { from: start, to: end }, { workspaceId, adAccountId })
    const platforms = Object.keys(metrics.platformBreakdown).map((platform) => platform.toUpperCase())

    const report = await prisma.report.create({
      data: {
        userId,
        workspaceId,
        adAccountId: adAccountId || null,
        name,
        type,
        startDate: start,
        endDate: end,
        platforms,
        schedule: schedule || null,
        config: config || null,
        status: 'generating',
      },
    })

    // b. Generate AI Insights
    const insights = await generateAIInsights(metrics)

    // c. Generate Action Plan
    const actionPlan = await generateActionPlan(metrics, insights)

    // 3. Generate legacy AI summary for compatibility
    const aiSummary = insights.wins.slice(0, 2).join(". ") + ". " + insights.concerns.slice(0, 1).join(". ");

    // 4. Finalize report with all data
    const updated = await prisma.report.update({
      where: { id: report.id },
      data: {
        metrics: metrics as any,
        insights: insights as any,
        recommendations: actionPlan as any,
        aiSummary,
        status: 'completed',
        lastRunAt: new Date(),
      },
    })

    return NextResponse.json({ ok: true, data: { report: updated } })
  } catch (error: any) {
    const noData = String(error?.message || "").includes("No verified") || String(error?.message || "").includes("No verified selected")
    return NextResponse.json({ ok: false, error: { code: noData ? 'NO_VERIFIED_REPORT_DATA' : 'INTERNAL', message: error.message } }, { status: noData ? 409 : 500 })
  }
}

// ============================================
// PATCH — Update report (schedule, config)
// ============================================
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 })
    }

    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, request)
    const body = await request.json()
    const { id, schedule, name, config } = body

    if (!id) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION', message: 'Report ID required' } }, { status: 400 })
    }

    const report = await prisma.report.update({
      where: { id, userId, ...workspaceWhere(workspaceId, false) },
      data: {
        ...(schedule !== undefined && { schedule, status: schedule ? 'scheduled' : 'completed' }),
        ...(name && { name }),
        ...(config && { config }),
      },
    })

    return NextResponse.json({ ok: true, data: { report } })
  } catch (error: any) {
    log("error", "api/reports", "Failed to update report", { message: error?.message })
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL', message: error.message } }, { status: 500 })
  }
}

// ============================================
// DELETE — Delete report
// ============================================
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 })
    }

    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, request)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION', message: 'Report ID required' } }, { status: 400 })
    }

    await prisma.report.delete({ where: { id, userId, ...workspaceWhere(workspaceId, false) } })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    log("error", "api/reports", "Failed to delete report", { message: error?.message })
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL', message: error.message } }, { status: 500 })
  }
}
