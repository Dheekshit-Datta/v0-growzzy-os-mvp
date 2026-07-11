import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { normalizeReportType } from "@/lib/report-template-renderer"
import { getRequestWorkspaceId } from "@/lib/workspace"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, req)
    const schedules = await prisma.scheduledReport.findMany({
      where: { userId, workspaceId },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ ok: true, schedules })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load schedules" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, req)
    const body = await req.json()

    if (!body?.name || !body?.frequency || !body?.sendTo) {
      return NextResponse.json({ error: "name, frequency and sendTo are required" }, { status: 400 })
    }
    const integration = await prisma.integration.findFirst({
      where: { userId, workspaceId, status: "ACTIVE", hasAdsAccess: true },
      select: { selectedAdAccountId: true, accountId: true },
    })
    const selectedAdAccountId = integration?.selectedAdAccountId || integration?.accountId || null
    if (!selectedAdAccountId || (body.adAccountId && body.adAccountId !== selectedAdAccountId)) {
      return NextResponse.json({ error: "Select an active ad account in this workspace before scheduling a report." }, { status: 409 })
    }

    const schedule = await prisma.scheduledReport.create({
      data: {
        userId,
        workspaceId,
        adAccountId: selectedAdAccountId,
        name: body.name,
        frequency: String(body.frequency).toUpperCase(),
        templateType: normalizeReportType(body.templateType),
        dayOfWeek: body.dayOfWeek ?? null,
        sendTo: body.sendTo,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      },
    })

    return NextResponse.json({ ok: true, schedule }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create schedule" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, req)
    const body = await req.json()
    if (!body?.id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const existing = await prisma.scheduledReport.findFirst({
      where: { id: body.id, userId, workspaceId },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (body.adAccountId !== undefined) {
      const integration = await prisma.integration.findFirst({
        where: {
          userId,
          workspaceId,
          status: "ACTIVE",
          hasAdsAccess: true,
          OR: [{ selectedAdAccountId: body.adAccountId }, { accountId: body.adAccountId }],
        },
        select: { id: true },
      })
      if (!integration) return NextResponse.json({ error: "The selected ad account is not active in this workspace." }, { status: 403 })
    }

    const schedule = await prisma.scheduledReport.update({
      where: { id: existing.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.frequency !== undefined ? { frequency: String(body.frequency).toUpperCase() } : {}),
        ...(body.templateType !== undefined ? { templateType: normalizeReportType(body.templateType) } : {}),
        ...(body.dayOfWeek !== undefined ? { dayOfWeek: body.dayOfWeek } : {}),
        ...(body.sendTo !== undefined ? { sendTo: body.sendTo } : {}),
        ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
        ...(body.adAccountId !== undefined ? { adAccountId: body.adAccountId || null } : {}),
      },
    })

    return NextResponse.json({ ok: true, schedule })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update schedule" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, req)
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const existing = await prisma.scheduledReport.findFirst({
      where: { id, userId, workspaceId },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await prisma.scheduledReport.delete({ where: { id: existing.id } })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete schedule" }, { status: 500 })
  }
}
