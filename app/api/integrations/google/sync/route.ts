import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/auth"
import { syncGoogleAdsCampaigns } from "@/lib/sync-engine"
import { GoogleAdsApiError } from "@/services/integrations/google"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { getIntegrationAccessToken } from "@/lib/integration-tokens"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"

const GOOGLE_SYNC_ACCESS_DENIED_MESSAGE =
  "Access Denied: Ensure you are using a Production Developer Token for real accounts, or use a Test Account for development."

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId()
    const limit = await rateLimitPolicy(userId, "platformSync")
    if (!limit.allowed) return rateLimitResponse(limit)
    const workspaceId = await getRequestWorkspaceId(userId, req)

    const integration = await prisma.integration.findFirst({
      where: { userId, workspaceId, platform: "GOOGLE" },
    })

    const accessToken = integration ? getIntegrationAccessToken(integration) : null
    if (!accessToken || !integration?.selectedAdAccountId) {
      return NextResponse.json({ error: "Google account not selected" }, { status: 400 })
    }

    const selectedAccount = await prisma.adAccount.findFirst({
      where: {
        integrationId: integration.id,
        externalId: integration.selectedAdAccountId,
      },
      select: {
        id: true,
        externalId: true,
        managerCustomerId: true,
      },
    })

    if (!selectedAccount) {
      return NextResponse.json({ error: "Selected account metadata not found" }, { status: 400 })
    }

    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        status: "INITIAL_SYNC_RUNNING",
        lastSyncStatus: "RUNNING",
        lastSyncError: null,
      },
    })

    try {
      const syncedCount = await syncGoogleAdsCampaigns(
        userId,
        integration.id,
        selectedAccount.id,
        selectedAccount.externalId,
        accessToken,
        selectedAccount.managerCustomerId
      )

      return NextResponse.json({
        ok: true,
        syncedCampaigns: syncedCount,
        status: "ACTIVE",
      })
    } catch (error: any) {
      if (error instanceof GoogleAdsApiError && error.status === 403) {
        await prisma.adAccount.update({
          where: { id: selectedAccount.id },
          data: { syncStatus: "ACCESS_DENIED", syncError: GOOGLE_SYNC_ACCESS_DENIED_MESSAGE },
        })

        await prisma.integration.update({
          where: { id: integration.id },
          data: {
            status: "ACTIVE",
            lastSyncStatus: "ACCESS_DENIED",
            lastSyncError: GOOGLE_SYNC_ACCESS_DENIED_MESSAGE,
          },
        })

        return NextResponse.json(
          {
            ok: false,
            status: "ACCESS_DENIED",
            message: GOOGLE_SYNC_ACCESS_DENIED_MESSAGE,
          },
          { status: 200 }
        )
      }

      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          status: "SYNC_FAILED",
          lastSyncStatus: "FAILED",
          lastSyncError: error.message || "Google sync failed",
        },
      })

      return NextResponse.json({ error: "Google sync failed", detail: error.message }, { status: 400 })
    }
  } catch (error: any) {
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 })
  }
}
