import { prisma } from "@/lib/prisma"
import { deriveMetrics } from "@/lib/metrics"
import { GoogleAdsService } from "@/services/integrations/google"
import { refreshGoogleAccessToken } from "@/lib/ads-detection"
import { log, reportError } from "@/lib/logger"
import { encryptedIntegrationTokens, getIntegrationAccessToken, getIntegrationRefreshToken } from "@/lib/integration-tokens"
import { generateAndPersistRecommendations } from "@/lib/ai-recommendation-engine"

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3, timeoutMs = 15_000): Promise<Response> {
  let lastError: Error = new Error("Request failed")

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, { ...options, signal: controller.signal })
      clearTimeout(timeout)

      if (response.status === 429 && attempt < maxRetries) {
        const retryAfter = Number(response.headers.get("Retry-After") || "2") * 1000
        await sleep(retryAfter)
        continue
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Auth error: ${response.status}`)
      }

      return response
    } catch (error: any) {
      clearTimeout(timeout)
      lastError = error
      if (attempt < maxRetries) await sleep(Math.pow(2, attempt - 1) * 1000)
    }
  }

  throw lastError
}

async function acquireSyncLock(userId: string, adAccountDbId: string) {
  const recentSync = await prisma.adAccount.findFirst({
    where: {
      userId,
      syncStatus: "SYNCING",
      updatedAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
    },
    select: { id: true },
  })

  if (recentSync && recentSync.id !== adAccountDbId) return false

  await prisma.adAccount.update({
    where: { id: adAccountDbId },
    data: { syncStatus: "SYNCING", syncError: null },
  })
  return true
}

export async function ensureFreshGoogleToken(integrationId: string, currentAccessToken: string) {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
    select: { refreshToken: true, refreshTokenEncrypted: true, tokenExpiresAt: true, expiresAt: true },
  })

  const refreshToken = integration ? getIntegrationRefreshToken(integration) : null
  if (!refreshToken) return currentAccessToken
  const expiresAt = integration?.tokenExpiresAt || integration?.expiresAt
  if (!expiresAt) return currentAccessToken

  if (expiresAt.getTime() > Date.now() + 10 * 60 * 1000) return currentAccessToken

  const refreshed = await refreshGoogleAccessToken(refreshToken)
  await prisma.integration.update({
    where: { id: integrationId },
    data: {
      ...encryptedIntegrationTokens(refreshed.accessToken),
      expiresAt: refreshed.expiresAt,
      tokenExpiresAt: refreshed.expiresAt,
    },
  })
  return refreshed.accessToken
}

export async function syncGoogleAdsCampaigns(
  userId: string,
  integrationId: string,
  adAccountDbId: string,
  externalAccountId: string,
  accessToken: string,
  managerCustomerId?: string | null
) {
  const hasLock = await acquireSyncLock(userId, adAccountDbId)
  if (!hasLock) {
    log("warn", "sync/google", "Sync skipped because another sync is already in progress", { userId, adAccountDbId })
    return 0
  }

  const resolvedAccessToken = await ensureFreshGoogleToken(integrationId, accessToken)
  const syncScope = await prisma.adAccount.findUnique({
    where: { id: adAccountDbId },
    select: { workspaceId: true },
  })
  const workspaceId =
    syncScope?.workspaceId ||
    (await prisma.integration.findUnique({ where: { id: integrationId }, select: { workspaceId: true } }))?.workspaceId ||
    null
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign_budget.amount_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 100
  `

  const preferredLoginCustomerId = managerCustomerId || externalAccountId
  try {
    const streamData = await GoogleAdsService.searchStream<any>({
      accessToken: resolvedAccessToken,
      customerId: externalAccountId,
      query,
      loginCustomerId: preferredLoginCustomerId,
    })

    const rows = Array.isArray(streamData) ? streamData.flatMap((chunk: any) => chunk.results ?? []) : []
    const errors: string[] = []
    let syncedCampaigns = 0
    const localCampaignIdByExternalId = new Map<string, string>()

    for (const row of rows) {
      const campaign = row.campaign || {}
      const metrics = row.metrics || {}
      const campaignBudget = row.campaignBudget || {}

      try {
        const spend = metrics.costMicros ? Number(metrics.costMicros) / 1_000_000 : 0
        const clicks = Number(metrics.clicks ?? 0)
        const impressions = Number(metrics.impressions ?? 0)
        const conversions = Number(metrics.conversions ?? 0)
        // Google Ads reports conversion value as a plain currency amount (not micros),
        // unlike cost/budget fields - this is what makes real ROAS reporting possible.
        const revenue = Number(metrics.conversionsValue ?? 0)
        const budgetAmount = campaignBudget.amountMicros ? Number(campaignBudget.amountMicros) / 1_000_000 : null
        const cpcVal = metrics.averageCpc ? Number(metrics.averageCpc) / 1_000_000 : null

        const derived = deriveMetrics({ spend, clicks, impressions, conversions, revenue })

        const upserted = await prisma.campaign.upsert({
          where: {
            integrationId_externalId: {
              integrationId,
              externalId: String(campaign.id),
            },
          },
          create: {
            integrationId,
            workspaceId,
            userId,
            platform: "GOOGLE",
            externalId: String(campaign.id),
            adAccountId: adAccountDbId,
            adAccountExternalId: externalAccountId,
            name: campaign.name || `Google Campaign ${campaign.id}`,
            status: campaign.status || "UNKNOWN",
            objective: campaign.advertisingChannelType,
            budgetAmount,
            budgetCurrency: "USD",
            impressions,
            clicks,
            spend,
            conversions,
            revenue,
            ctr: derived.ctr,
            cpa: derived.cpa,
            cpc: cpcVal,
            roas: derived.roas,
            rawData: row,
            syncedAt: new Date(),
            isLive: true,
            liveStatus: campaign.status === "ENABLED" ? "LIVE_ENABLED" : "LIVE_PAUSED",
            verifiedAt: new Date(),
          },
          update: {
            integrationId,
            workspaceId,
            userId,
            adAccountId: adAccountDbId,
            adAccountExternalId: externalAccountId,
            name: campaign.name || `Google Campaign ${campaign.id}`,
            status: campaign.status || "UNKNOWN",
            objective: campaign.advertisingChannelType,
            budgetAmount,
            impressions,
            clicks,
            spend,
            conversions,
            ctr: derived.ctr,
            cpa: derived.cpa,
            cpc: cpcVal,
            roas: derived.roas,
            rawData: row,
            syncedAt: new Date(),
            lastSeenAt: new Date(),
            isLive: true,
            liveStatus: campaign.status === "ENABLED" ? "LIVE_ENABLED" : "LIVE_PAUSED",
            verifiedAt: new Date(),
            liveError: null,
          },
        })
        localCampaignIdByExternalId.set(String(campaign.id), upserted.id)
        syncedCampaigns += 1
      } catch (error: any) {
        errors.push(`Campaign ${campaign.id || "unknown"}: ${error?.message || "Unknown error"}`)
      }
    }

    // Per-day breakdown for trend detection (lib/ai-recommendation-engine.ts) -
    // the query above is an aggregate over LAST_30_DAYS with one row per
    // campaign, which can't show whether a campaign is trending up or down.
    // Separate query segmented by date, only for campaigns that synced above.
    if (localCampaignIdByExternalId.size > 0) {
      try {
        const dailyQuery = `
          SELECT
            campaign.id,
            segments.date,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value
          FROM campaign
          WHERE segments.date DURING LAST_14_DAYS
            AND campaign.status != 'REMOVED'
        `
        const dailyStreamData = await GoogleAdsService.searchStream<any>({
          accessToken: resolvedAccessToken,
          customerId: externalAccountId,
          query: dailyQuery,
          loginCustomerId: preferredLoginCustomerId,
        })
        const dailyRows = Array.isArray(dailyStreamData) ? dailyStreamData.flatMap((chunk: any) => chunk.results ?? []) : []

        for (const row of dailyRows) {
          const externalCampaignId = String(row.campaign?.id || "")
          const localCampaignId = localCampaignIdByExternalId.get(externalCampaignId)
          const dateStr = row.segments?.date
          if (!localCampaignId || !dateStr) continue

          const metricDate = new Date(`${dateStr}T00:00:00.000Z`)
          const metrics = row.metrics || {}
          const spend = metrics.costMicros ? Number(metrics.costMicros) / 1_000_000 : 0
          const clicks = Number(metrics.clicks ?? 0)
          const impressions = Number(metrics.impressions ?? 0)
          const conversions = Number(metrics.conversions ?? 0)
          const revenue = Number(metrics.conversionsValue ?? 0)
          const derived = deriveMetrics({ spend, clicks, impressions, conversions, revenue })

          await prisma.campaignMetricDaily.upsert({
            where: { campaignId_metricDate: { campaignId: localCampaignId, metricDate } },
            create: {
              campaignId: localCampaignId,
              platform: "GOOGLE",
              metricDate,
              impressions,
              clicks,
              spend,
              conversions,
              revenue,
              ctr: derived.ctr,
              cpa: derived.cpa,
              roas: derived.roas,
            },
            update: {
              impressions,
              clicks,
              spend,
              conversions,
              revenue,
              ctr: derived.ctr,
              cpa: derived.cpa,
              roas: derived.roas,
            },
          })
        }
      } catch (dailyError: any) {
        // Non-fatal - the aggregate campaign sync above already succeeded and
        // is what the rest of the app depends on; trend detection just won't
        // have fresh data until the next successful sync.
        log("warn", "sync/google", "Daily metric sync failed", { userId, adAccountDbId, message: dailyError?.message })
      }
    }

    // Ad-level sync for creative testing (which variant is winning, and
    // fatigue detection over time) - separate from the campaign-level sync
    // above, which only ever saw aggregate numbers. Pulls real ad_group_ad
    // performance and upserts AdGroup/Ad/AdMetricDaily even for ad groups
    // that were never launched through this app (matched by externalId).
    if (localCampaignIdByExternalId.size > 0) {
      try {
        const creativeQuery = `
          SELECT
            campaign.id,
            ad_group.id,
            ad_group.name,
            ad_group_ad.ad.id,
            ad_group_ad.ad.resource_name,
            ad_group_ad.status,
            ad_group_ad.ad.responsive_search_ad.headlines,
            ad_group_ad.ad.responsive_search_ad.descriptions,
            ad_group_ad.ad.final_urls,
            segments.date,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value
          FROM ad_group_ad
          WHERE segments.date DURING LAST_14_DAYS
            AND campaign.status != 'REMOVED'
            AND ad_group_ad.status != 'REMOVED'
          ORDER BY campaign.id
          LIMIT 3000
        `
        const creativeStreamData = await GoogleAdsService.searchStream<any>({
          accessToken: resolvedAccessToken,
          customerId: externalAccountId,
          query: creativeQuery,
          loginCustomerId: preferredLoginCustomerId,
        })
        const creativeRows = Array.isArray(creativeStreamData) ? creativeStreamData.flatMap((chunk: any) => chunk.results ?? []) : []

        const localAdIdByExternalId = new Map<string, string>()

        for (const row of creativeRows) {
          const externalCampaignId = String(row.campaign?.id || "")
          const localCampaignId = localCampaignIdByExternalId.get(externalCampaignId)
          const externalAdGroupId = String(row.adGroup?.id || "")
          const externalAdId = String(row.adGroupAd?.ad?.id || "")
          const dateStr = row.segments?.date
          if (!localCampaignId || !externalAdGroupId || !externalAdId || !dateStr) continue

          const cacheKey = `${externalAdGroupId}:${externalAdId}`
          let localAdId = localAdIdByExternalId.get(cacheKey)

          if (!localAdId) {
            const localAdGroup = await prisma.adGroup.upsert({
              where: { campaignId_externalId: { campaignId: localCampaignId, externalId: externalAdGroupId } },
              create: { userId, campaignId: localCampaignId, externalId: externalAdGroupId, name: row.adGroup?.name || "Ad Group", isLive: true },
              update: { name: row.adGroup?.name || "Ad Group" },
            })

            const headlines = (row.adGroupAd?.ad?.responsiveSearchAd?.headlines || []).map((h: any) => ({ text: h?.text || "" })).filter((h: any) => h.text)
            const descriptions = (row.adGroupAd?.ad?.responsiveSearchAd?.descriptions || []).map((d: any) => ({ text: d?.text || "" })).filter((d: any) => d.text)
            const finalUrl = (row.adGroupAd?.ad?.finalUrls || [])[0] || ""
            const status = row.adGroupAd?.status || "ENABLED"

            const localAd = await prisma.ad.upsert({
              where: { adGroupId_externalId: { adGroupId: localAdGroup.id, externalId: externalAdId } },
              create: {
                userId,
                adGroupId: localAdGroup.id,
                externalId: externalAdId,
                resourceName: row.adGroupAd?.ad?.resourceName || null,
                headlines: headlines.length ? headlines : [{ text: "(no headlines synced)" }],
                descriptions: descriptions.length ? descriptions : [{ text: "(no descriptions synced)" }],
                finalUrl,
                status,
                isLive: true,
              },
              update: {
                resourceName: row.adGroupAd?.ad?.resourceName || null,
                ...(headlines.length ? { headlines } : {}),
                ...(descriptions.length ? { descriptions } : {}),
                ...(finalUrl ? { finalUrl } : {}),
                status,
              },
            })
            localAdId = localAd.id
            localAdIdByExternalId.set(cacheKey, localAdId)
          }

          const metricDate = new Date(`${dateStr}T00:00:00.000Z`)
          const metrics = row.metrics || {}
          const spend = metrics.costMicros ? Number(metrics.costMicros) / 1_000_000 : 0
          const clicks = Number(metrics.clicks ?? 0)
          const impressions = Number(metrics.impressions ?? 0)
          const conversions = Number(metrics.conversions ?? 0)
          const revenue = Number(metrics.conversionsValue ?? 0)
          const derived = deriveMetrics({ spend, clicks, impressions, conversions, revenue })

          await prisma.adMetricDaily.upsert({
            where: { adId_metricDate: { adId: localAdId, metricDate } },
            create: { adId: localAdId, metricDate, impressions, clicks, spend, conversions, revenue, ctr: derived.ctr, cpa: derived.cpa, roas: derived.roas },
            update: { impressions, clicks, spend, conversions, revenue, ctr: derived.ctr, cpa: derived.cpa, roas: derived.roas },
          })
        }
      } catch (creativeError: any) {
        // Non-fatal for the same reason as the daily-metric sync above -
        // creative testing data just won't refresh until the next sync.
        log("warn", "sync/google", "Ad-level creative sync failed", { userId, adAccountDbId, message: creativeError?.message })
      }
    }

    const partialError = rows.length > 0 && errors.length >= rows.length / 2
    const syncStatus = partialError ? "PARTIAL_ERROR" : "SYNCED"
    const syncError = errors.length ? errors.slice(0, 10).join("\n") : null

    await prisma.adAccount.update({
      where: { id: adAccountDbId },
      data: { lastSyncedAt: new Date(), syncStatus, syncError },
    })

    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        status: "ACTIVE",
        lastSyncAt: new Date(),
        lastSyncedAt: new Date(),
        lastSyncStatus: partialError ? "PARTIAL_ERROR" : "SUCCESS",
        syncStatus,
        lastSyncError: syncError,
        hasAdsAccess: true,
      },
    })

    if (errors.length) {
      log("warn", "sync/google", "Google sync completed with row-level errors", { userId, adAccountDbId, errorCount: errors.length })
    }

    if (workspaceId && syncedCampaigns > 0) {
      generateAndPersistRecommendations({ userId, workspaceId }).catch((recError: any) =>
        log("error", "sync/google", "Recommendation generation after sync failed", { message: recError?.message })
      )
    }

    return syncedCampaigns
  } catch (error: any) {
    reportError(error, "sync/google", { userId, workspaceId, integrationId, adAccountDbId })
    await prisma.adAccount.update({
      where: { id: adAccountDbId },
      data: { syncStatus: "ERROR", syncError: error?.message || "Google sync failed" },
    })
    throw error
  }
}

export async function syncGoogleIntegration(integration: any) {
  if (integration.platform !== "GOOGLE") return 0
  const accessToken = getIntegrationAccessToken(integration)
  if (!accessToken || !integration.selectedAdAccountId) {
    throw new Error("Missing Google access token or selected ad account")
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
    throw new Error("Selected Google ad account metadata not found")
  }

  return syncGoogleAdsCampaigns(
    integration.userId,
    integration.id,
    selectedAccount.id,
    selectedAccount.externalId,
    accessToken,
    selectedAccount.managerCustomerId
  )
}

export async function syncMetaAdsCampaigns(
  userId: string,
  integrationId: string,
  _adAccountDbId: string,
  externalAccountId: string,
  _accessToken: string
) {
  await prisma.integration.update({
    where: { id: integrationId },
    data: {
      status: "ACTIVE",
      lastSyncAt: new Date(),
      lastSyncedAt: new Date(),
      lastSyncStatus: "SUCCESS",
      syncStatus: "SYNCED",
      lastSyncError: null,
      hasAdsAccess: true,
    },
  })

  return prisma.campaign.count({
    where: { userId, platform: "META", adAccountExternalId: externalAccountId },
  })
}
