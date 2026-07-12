import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { resolveUserId } from "@/lib/resolve-user"
import { NextResponse } from "next/server"
import { getPrimaryWorkspaceId, getRequestWorkspaceId, workspaceWhere } from "@/lib/workspace"
import { log } from "@/lib/logger"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
    try {
      const session = await auth()
      if (!session?.user?.id) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const userId = await resolveUserId(session.user.id)
      let workspaceId: string
      try {
        workspaceId = await getRequestWorkspaceId(userId, req as any)
      } catch (workspaceError: any) {
        log("warn", "integrations", "Workspace resolution failed; falling back to primary workspace", {
          message: workspaceError?.message,
        })
        workspaceId = await getPrimaryWorkspaceId(userId)
      }
      const workspaceFilter = workspaceWhere(workspaceId, false)

      const integrations = await prisma.integration.findMany({
          where: { userId, ...workspaceFilter },
          include: {
              adAccounts: {
                  where: { workspaceId },
                  select: {
                      externalId: true,
                      name: true,
                      isPrimary: true,
                      lastSyncedAt: true,
                      syncStatus: true,
                  },
                  orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
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

      const result: Record<string, any> = {}
      let hasAnyAdsAccess = false

      for (const integration of integrations) {
          const providerId = integration.platform.toLowerCase()
          const primaryMappedAccount = integration.adAccounts.find((account) => account.isPrimary) || integration.adAccounts[0]
          const resolvedAccountId = integration.selectedAdAccountId || integration.accountId || primaryMappedAccount?.externalId || null
          const resolvedAccountName = integration.selectedAdAccountName || integration.accountName || primaryMappedAccount?.name || null
          const resolvedLastSynced = integration.lastSyncAt || integration.lastSyncedAt || primaryMappedAccount?.lastSyncedAt || null
          const hasAdsAccount = Boolean(integration.hasAdsAccount || resolvedAccountId || integration.adAccounts.length > 0)
          if (integration.hasAdsAccess || hasAdsAccount) hasAnyAdsAccess = true
          result[providerId] = {
              id: integration.id,
              status: integration.status,
              hasAdsAccount,
              hasAdsAccess: integration.hasAdsAccess,
              adAccountId: resolvedAccountId,
              adAccountName: resolvedAccountName,
              adAccounts: integration.adAccounts,
              lastSynced: resolvedLastSynced?.toISOString() ?? null,
              lastSyncStatus: integration.lastSyncStatus,
              lastSyncError: integration.lastSyncError,
              connectedAt: integration.createdAt.toISOString(),
              updatedAt: integration.updatedAt.toISOString(),
              syncDiagnostics: {
                  accountMatch: hasAdsAccount,
                  importedCampaigns: campaignCountsByIntegrationId.get(integration.id) || 0,
                  providerStatus: integration.lastSyncStatus || integration.status,
                  providerMessage: integration.lastSyncError || null,
                  staleData: resolvedLastSynced ? Date.now() - resolvedLastSynced.getTime() > 24 * 60 * 60 * 1000 : true,
                  selectedAccountId: resolvedAccountId,
              },
          }
      }

      return NextResponse.json({ success: true, integrations: result, hasAnyAdsAccess })
    } catch (error: any) {
      log("error", "integrations", "Failed to load integrations", {
        message: error?.message,
        code: error?.code,
      })
      return NextResponse.json({ error: error?.message || "Failed to load integrations" }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    try {
      const session = await auth()
      if (!session?.user?.id) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const { provider } = await req.json().catch(() => ({}))
      if (!provider) {
          return NextResponse.json({ error: "Provider is required" }, { status: 400 })
      }

      const userId = await resolveUserId(session.user.id)
      let workspaceId: string
      try {
        workspaceId = await getRequestWorkspaceId(userId, req as any)
      } catch (workspaceError: any) {
        log("warn", "integrations", "Workspace resolution failed during delete; falling back to primary workspace", {
          message: workspaceError?.message,
        })
        workspaceId = await getPrimaryWorkspaceId(userId)
      }
      const workspaceFilter = workspaceWhere(workspaceId, false)
      const platformName = provider.toUpperCase()

      await prisma.integration.deleteMany({
          where: { userId, platform: platformName, ...workspaceFilter }
      })

      return NextResponse.json({ success: true })
    } catch (error: any) {
      log("error", "integrations", "Failed to delete integration", {
        message: error?.message,
        code: error?.code,
      })
      return NextResponse.json({ error: error?.message || "Failed to delete integration" }, { status: 500 })
    }
}
