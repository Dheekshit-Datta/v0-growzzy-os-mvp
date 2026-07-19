import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { createGoogleKeywords } from "@/lib/platform-actions"
import { log } from "@/lib/logger"
import { getIntegrationAccessToken } from "@/lib/integration-tokens"
import { getRequestWorkspaceId } from "@/lib/workspace"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, req)
    const { adGroupId, keywords } = await req.json()
    if (!adGroupId || !Array.isArray(keywords)) return NextResponse.json({ error: "adGroupId and keywords are required" }, { status: 400 })

    const adGroup = await prisma.adGroup.findFirst({
      where: { id: adGroupId, userId, campaign: { workspaceId } },
      include: { campaign: { include: { integration: { include: { adAccounts: { where: { isPrimary: true } } } } } } },
    })
    if (!adGroup) return NextResponse.json({ error: "Ad group not found" }, { status: 404 })

    let liveError: string | null = null
    try {
      const integration = adGroup.campaign.integration
      const primary = integration.adAccounts[0]
      const customerId = primary?.externalId || adGroup.campaign.adAccountId || integration.selectedAdAccountId
      const accessToken = getIntegrationAccessToken(integration)
      if (adGroup.campaign.platform === "GOOGLE" && accessToken && customerId && adGroup.externalId) {
        await createGoogleKeywords({
          accessToken,
          customerId,
          adGroupId: adGroup.externalId,
          keywords,
          loginCustomerId: primary?.managerCustomerId || customerId,
        })
      }
    } catch (error: any) {
      liveError = error?.message || "Failed to push keywords to Google Ads"
    }

    const created = await prisma.$transaction(
      keywords.map((keyword: any) =>
        prisma.keyword.create({
          data: {
            userId,
            adGroupId,
            text: String(keyword.text || keyword.keyword || "").trim(),
            matchType: String(keyword.matchType || "BROAD").toUpperCase(),
            isNegative: !!keyword.isNegative,
            bid: keyword.bid ? Number(keyword.bid) : null,
          },
        })
      )
    )
    return NextResponse.json({ ok: true, keywords: created, liveError })
  } catch (error: any) {
    log("error", "api/keywords", "Failed to save keywords", { message: error?.message })
    return NextResponse.json({ error: "Failed to save keywords" }, { status: 500 })
  }
}
