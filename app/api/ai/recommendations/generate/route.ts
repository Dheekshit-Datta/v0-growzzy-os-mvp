export const dynamic = "force-dynamic"

import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { generateAIRecommendations } from "@/lib/ai-recommendation-engine"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = await resolveUserId(session.user.id)
  const workspaceId = await getRequestWorkspaceId(userId, request)
  const body = await request.json().catch(() => ({}))
  const adAccountId = typeof body?.adAccountId === "string" ? body.adAccountId : null

  const recommendations = await generateAIRecommendations({
    userId,
    workspaceId,
    adAccountId,
  })

  if (!recommendations.length) {
    return NextResponse.json(
      {
        success: false,
        code: "NO_VERIFIED_CAMPAIGN_DATA",
        error: "No verified campaign data available. Connect and sync your ad account to generate recommendations.",
      },
      { status: 409 }
    )
  }

  return NextResponse.json({
    success: true,
    count: recommendations.length,
    recommendations,
  })
}
