import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { createGoogleResponsiveSearchAd } from "@/lib/platform-actions"
import { log } from "@/lib/logger"
import { getIntegrationAccessToken } from "@/lib/integration-tokens"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = await resolveUserId(session.user.id)
    const { adGroupId, headlines, descriptions, finalUrl, displayPath1, displayPath2, adStrength } = await req.json()
    if (!adGroupId || !finalUrl || !Array.isArray(headlines) || !Array.isArray(descriptions)) {
      return NextResponse.json({ error: "adGroupId, finalUrl, headlines and descriptions are required" }, { status: 400 })
    }
    if (headlines.filter((h: any) => h.text).length < 3 || descriptions.filter((d: any) => d.text).length < 1) {
      return NextResponse.json({ error: "At least 3 headlines and 1 description are required" }, { status: 400 })
    }

    const adGroup = await prisma.adGroup.findFirst({
      where: { id: adGroupId, userId },
      include: { campaign: { include: { integration: { include: { adAccounts: { where: { isPrimary: true } } } } } } },
    })
    if (!adGroup) return NextResponse.json({ error: "Ad group not found" }, { status: 404 })

    let resourceName: string | null = null
    let externalId: string | null = null
    let isLive = false
    let liveError: string | null = null

    try {
      const integration = adGroup.campaign.integration
      const primary = integration.adAccounts[0]
      const customerId = primary?.externalId || adGroup.campaign.adAccountId || integration.selectedAdAccountId
      const accessToken = getIntegrationAccessToken(integration)
      if (adGroup.campaign.platform === "GOOGLE" && accessToken && customerId && adGroup.externalId) {
        const result = await createGoogleResponsiveSearchAd({
          accessToken,
          customerId,
          adGroupId: adGroup.externalId,
          headlines,
          descriptions,
          finalUrl,
          displayPath1,
          displayPath2,
          loginCustomerId: primary?.managerCustomerId || customerId,
        })
        resourceName = result.resourceName
        externalId = result.adId
        isLive = !!resourceName
      }
    } catch (error: any) {
      liveError = error?.message || "Failed to publish ad to Google Ads"
    }

    const ad = await prisma.ad.create({
      data: {
        userId,
        adGroupId,
        externalId,
        headlines,
        descriptions,
        finalUrl,
        displayPath1,
        displayPath2,
        adStrength,
        resourceName,
        isLive,
      },
    })
    await prisma.campaign.update({ where: { id: adGroup.campaignId }, data: { hasCreative: true } })
    return NextResponse.json({ ok: true, ad, liveError })
  } catch (error: any) {
    log("error", "api/ads", "Failed to save ad", { message: error?.message })
    return NextResponse.json({ error: "Failed to save ad" }, { status: 500 })
  }
}
