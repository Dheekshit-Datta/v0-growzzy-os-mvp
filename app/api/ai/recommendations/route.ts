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

    const [suggestions, total, healthScore] = await Promise.all([
        prisma.optimizationSuggestion.findMany({
            where: { workspaceId, dismissed: false },
            orderBy: [{ applied: "asc" }, { confidence: "desc" }, { createdAt: "desc" }],
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.optimizationSuggestion.count({
            where: { workspaceId, dismissed: false },
        }),
        prisma.accountHealthScore.findFirst({ where: { userId } }),
    ])

    // Estimate total impact
    const totalImpact = suggestions.reduce((sum, s) => {
        const impact = (s.projectedImpact as any)?.estimatedDeltaRevenue ?? 0
        return sum + Math.abs(Number(impact))
    }, 0)

    return NextResponse.json({
        success: true,
        suggestions,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        healthScore: healthScore ?? null,
        totalEstimatedImpact: parseFloat(totalImpact.toFixed(2)),
    })
}
