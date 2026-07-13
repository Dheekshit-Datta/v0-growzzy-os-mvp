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
    const selectedAccount =
      integration.adAccounts.find((account) => account.externalId === integration.selectedAdAccountId) ||
      integration.adAccounts.find((account) => account.isPrimary) ||
      null
    const hasSelectedAccount = Boolean(integration.hasAdsAccess && selectedAccount)
    result[key] = {
      connected: true,
      hasAdsAccount: hasSelectedAccount,
      hasAdsAccess: integration.hasAdsAccess,
      status: integration.status,
      accountId: integration.accountId,
      accountName: integration.accountName,
      selectedAdAccountId: selectedAccount?.externalId || null,
      selectedAdAccountName: selectedAccount?.name || null,
      adAccounts: integration.adAccounts,
      primaryAccount: selectedAccount,
      connectedAt: integration.createdAt,
      lastSyncAt: integration.lastSyncAt,
      lastSyncStatus: integration.lastSyncStatus,
      lastSyncError: integration.lastSyncError,
      verifiedCampaignCount: campaignCountsByIntegrationId.get(integration.id) || 0,
      syncDiagnostics: {
        accountMatch: hasSelectedAccount,
        importedCampaigns: campaignCountsByIntegrationId.get(integration.id) || 0,
        providerStatus: integration.lastSyncStatus || integration.status,
        providerMessage: integration.lastSyncError || null,
        staleData: stale,
        selectedAccountId: selectedAccount?.externalId || null,
      },
    }

    if (hasSelectedAccount) {
      result.hasAnyAdsAccess = true
    }
  }

  return NextResponse.json(result)
}
