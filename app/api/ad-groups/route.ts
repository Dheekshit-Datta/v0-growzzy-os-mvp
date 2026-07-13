import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { createGoogleAdGroup } from "@/lib/platform-actions"
import { log } from "@/lib/logger"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { getActiveAdAccountScope } from "@/lib/account-scope"
import { getIntegrationAccessToken } from "@/lib/integration-tokens"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, req)
    const scope = await getActiveAdAccountScope(userId, workspaceId, req.nextUrl.searchParams.get("adAccountId"))
    if (!scope) return NextResponse.json({ ok: true, adGroups: [], accountRequired: true })
    const campaignId = req.nextUrl.searchParams.get("campaignId")
    const adGroups = await prisma.adGroup.findMany({
      where: {
        userId,
        ...(campaignId ? { campaignId } : {}),
        campaign: { workspaceId, adAccountId: scope.adAccountId },
      },
      include: { _count: { select: { keywords: true, ads: true } } },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ ok: true, adGroups })
  } catch (error: any) {
    log("error", "api/ad-groups", "Failed to load ad groups", { message: error?.message })
    return NextResponse.json({ error: "Failed to load ad groups" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, req)
    const scope = await getActiveAdAccountScope(userId, workspaceId)
    if (!scope) return NextResponse.json({ error: "Select an ad account before creating ad groups." }, { status: 409 })
    const { campaignId, name, theme, defaultBid } = await req.json()
    if (!campaignId || !name) return NextResponse.json({ error: "campaignId and name are required" }, { status: 400 })

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId, workspaceId, adAccountId: scope.adAccountId },
      include: { integration: { include: { adAccounts: { where: { isPrimary: true } } } } },
    })
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })

    let externalId: string | null = null
    let isLive = false
    let liveError: string | null = null

    try {
      const primary = campaign.integration.adAccounts[0]
      const customerId = primary?.externalId || campaign.adAccountId || campaign.integration.selectedAdAccountId
      const accessToken = getIntegrationAccessToken(campaign.integration)
      if (campaign.platform === "GOOGLE" && accessToken && customerId && campaign.isLive) {
        const result = await createGoogleAdGroup({
          accessToken,
          customerId,
          campaignId: campaign.externalId,
          name,
          defaultBidMicros: defaultBid ? Math.round(Number(defaultBid) * 1_000_000) : null,
          loginCustomerId: primary?.managerCustomerId || customerId,
        })
        externalId = result.adGroupId
        isLive = !!result.resourceName
      }
    } catch (error: any) {
      liveError = error?.message || "Failed to create ad group in Google Ads"
    }

    const adGroup = await prisma.adGroup.create({
      data: {
        userId,
        campaignId,
        name,
        theme,
        defaultBid: defaultBid ? Number(defaultBid) : null,
        externalId,
        isLive,
        status: "ENABLED",
      },
    })

    return NextResponse.json({ ok: true, adGroup, liveError })
  } catch (error: any) {
    log("error", "api/ad-groups", "Failed to create ad group", { message: error?.message })
    return NextResponse.json({ error: "Failed to create ad group" }, { status: 500 })
  }
}
