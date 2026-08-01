export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { resolveUserId } from "@/lib/resolve-user"
import { prisma } from "@/lib/prisma"
import { accountIdVariants } from "@/lib/account-id"
import { getPrimaryWorkspaceId, getRequestWorkspaceId } from "@/lib/workspace"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = await resolveUserId(session.user.id)
  let workspaceId: string
  try {
    workspaceId = await getRequestWorkspaceId(userId, req)
  } catch {
    workspaceId = await getPrimaryWorkspaceId(userId)
  }

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
        take: 100,
      },
    },
    take: 20,
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
    meta: null,
    hasAnyAdsAccess: false,
  }

  for (const integration of integrations) {
    if (integration.platform !== "GOOGLE" && integration.platform !== "META") continue
    const key = integration.platform === "META" ? "meta" : "google"

    const lastSyncedAt = integration.lastSyncAt || integration.lastSyncedAt
    const stale = lastSyncedAt ? Date.now() - new Date(lastSyncedAt).getTime() > 24 * 60 * 60 * 1000 : true
    const selectedAccountIds = accountIdVariants(integration.selectedAdAccountId)
    const selectedAccount =
      integration.adAccounts.find((account) => selectedAccountIds.includes(account.externalId)) ||
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
