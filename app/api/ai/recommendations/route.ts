/**
 * /api/ai/recommendations (GET)
 * Returns paginated OptimizationSuggestion list, enriched with CampaignScores.
 */
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { NextRequest, NextResponse } from "next/server"
import { getRequestWorkspaceId } from "@/lib/workspace"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, req)
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get("page") ?? "1", 10)
    const pageSize = 20

    const [suggestions, total] = await Promise.all([
        prisma.optimizationSuggestion.findMany({
            where: { workspaceId, dismissed: false },
            orderBy: [{ applied: "asc" }, { confidence: "desc" }, { createdAt: "desc" }],
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.optimizationSuggestion.count({
            where: { workspaceId, dismissed: false },
        }),
    ])

    const campaignIds = [...new Set(suggestions.map((s) => s.campaignId).filter(Boolean))] as string[]
    const campaigns = campaignIds.length
        ? await prisma.campaign.findMany({ where: { id: { in: campaignIds }, workspaceId }, select: { id: true, name: true }, take: 20 })
        : []
    const campaignNameById = new Map(campaigns.map((c) => [c.id, c.name]))

    // Estimate total impact
    const totalImpact = suggestions.reduce((sum, s) => {
        const impact = (s.projectedImpact as any)?.estimatedDeltaRevenue ?? 0
        return sum + Math.abs(Number(impact))
    }, 0)

    return NextResponse.json({
        success: true,
        suggestions: suggestions.map((s) => ({ ...s, campaignName: s.campaignId ? campaignNameById.get(s.campaignId) || null : null })),
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        healthScore: null,
        totalEstimatedImpact: parseFloat(totalImpact.toFixed(2)),
    })
}

export async function PATCH(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, req)
    const body = await req.json().catch(() => ({}))
    const suggestionId = typeof body?.suggestionId === "string" ? body.suggestionId : null
    if (!suggestionId) return NextResponse.json({ error: "suggestionId is required" }, { status: 400 })

    const existing = await prisma.optimizationSuggestion.findFirst({ where: { id: suggestionId, workspaceId } })
    if (!existing) return NextResponse.json({ error: "Suggestion not found" }, { status: 404 })

    const suggestion = await prisma.optimizationSuggestion.update({
        where: { id: suggestionId },
        data: { dismissed: body.dismissed !== false },
    })
    return NextResponse.json({ ok: true, suggestion })
}
