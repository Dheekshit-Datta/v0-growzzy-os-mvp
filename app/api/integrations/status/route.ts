export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { resolveUserId } from "@/lib/resolve-user"
import { prisma } from "@/lib/prisma"
import { getRequestWorkspaceId } from "@/lib/workspace"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = await resolveUserId(session.user.id)
  const workspaceId = await getRequestWorkspaceId(userId, req)

  const integrations = await prisma.integration.findMany({
    where: { userId, workspaceId },
    include: {
      adAccounts: {
        select: {
          id: true,
          externalId: true,
          name: true,
          currencyCode: true,
          isPrimary: true,
          syncStatus: true,
          lastSyncedAt: true,
        },
      },
    },
  })

  const campaignCountsByIntegrationId = new Map<string, number>()
  const integrationIds = integrations.map((integration) => integration.id)
  if (integrationIds.length > 0) {
    const grouped = await prisma.campaign.groupBy({
      by: ["integrationId"],
      where: { integrationId: { in: integrationIds } },
      _count: { _all: true },
    })
    for (const row of grouped) campaignCountsByIntegrationId.set(row.integrationId, row._count._all)
  }

  const result: Record<string, any> = {
    google: null,
    hasAnyAdsAccess: false,
  }

  for (const integration of integrations) {
    if (integration.platform !== "GOOGLE") continue
    const key = "google"

    const lastSyncedAt = integration.lastSyncAt || integration.lastSyncedAt
    const stale = lastSyncedAt ? Date.now() - new Date(lastSyncedAt).getTime() > 24 * 60 * 60 * 1000 : true
    result[key] = {
      connected: true,
      hasAdsAccount: integration.hasAdsAccount || Boolean(integration.selectedAdAccountId || integration.accountId || integration.adAccounts.length),
      hasAdsAccess: integration.hasAdsAccess,
      status: integration.status,
      accountId: integration.accountId,
      accountName: integration.accountName,
      selectedAdAccountId: integration.selectedAdAccountId,
      selectedAdAccountName: integration.selectedAdAccountName,
      adAccounts: integration.adAccounts,
      primaryAccount: integration.adAccounts.find((a) => a.isPrimary) ?? null,
      connectedAt: integration.createdAt,
      lastSyncAt: integration.lastSyncAt,
      lastSyncStatus: integration.lastSyncStatus,
      lastSyncError: integration.lastSyncError,
      verifiedCampaignCount: campaignCountsByIntegrationId.get(integration.id) || 0,
      syncDiagnostics: {
        accountMatch: Boolean(integration.selectedAdAccountId || integration.accountId || integration.adAccounts.length),
        importedCampaigns: campaignCountsByIntegrationId.get(integration.id) || 0,
        providerStatus: integration.lastSyncStatus || integration.status,
        providerMessage: integration.lastSyncError || null,
        staleData: stale,
        selectedAccountId: integration.selectedAdAccountId || integration.accountId || integration.adAccounts.find((a) => a.isPrimary)?.externalId || null,
      },
    }

    if (integration.hasAdsAccess || integration.selectedAdAccountId || integration.accountId) {
      result.hasAnyAdsAccess = true
    }
  }

  return NextResponse.json(result)
}
