import { prisma } from "@/lib/prisma"
import { deriveMetrics } from "@/lib/metrics"
import { GoogleAdsService } from "@/services/integrations/google"
import { refreshGoogleAccessToken } from "@/lib/ads-detection"
import { log, reportError } from "@/lib/logger"
import { encryptedIntegrationTokens, getIntegrationAccessToken, getIntegrationRefreshToken } from "@/lib/integration-tokens"
import { generateAndPersistRecommendations } from "@/lib/ai-recommendation-engine"
import { MetaAdsService, parseMetaInsight } from "@/services/integrations/meta"

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
    select: { refreshTokenEncrypted: true, tokenExpiresAt: true, expiresAt: true },
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
  adAccountDbId: string,
  externalAccountId: string,
  accessToken: string
) {
  const hasLock = await acquireSyncLock(userId, adAccountDbId)
  if (!hasLock) return 0
  const scope = await prisma.adAccount.findFirst({
    where: { id: adAccountDbId, integrationId, externalId: externalAccountId, userId },
    select: { workspaceId: true, currencyCode: true },
  })
  if (!scope) throw new Error("Selected Meta ad account does not belong to this integration")

  const metrics = (row: any) => {
    const parsed = parseMetaInsight(row)
    return { ...parsed, ...deriveMetrics(parsed) }
  }
  const inChunks = async <T>(rows: T[], work: (row: T) => Promise<void>, size = 25) => {
    for (let index = 0; index < rows.length; index += size) await Promise.all(rows.slice(index, index + size).map(work))
  }

  try {
    const snapshot = await MetaAdsService.readAccountSnapshot(accessToken, externalAccountId)
    const insightByCampaign = new Map<string, any[]>()
    for (const row of snapshot.campaignInsights) {
      const key = String(row.campaign_id || "")
      if (key) insightByCampaign.set(key, [...(insightByCampaign.get(key) || []), row])
    }
    const campaignIds = new Map<string, string>()

    await inChunks(snapshot.campaigns, async (campaign) => {
      const externalId = String(campaign.id || "")
      if (!externalId) return
      const dailyRows = insightByCampaign.get(externalId) || []
      const totals = dailyRows.reduce(
        (sum, row) => {
          const value = metrics(row)
          sum.impressions += value.impressions
          sum.clicks += value.clicks
          sum.spend += value.spend
          sum.conversions += value.conversions
          sum.leads += value.leads
          sum.revenue += value.revenue
          return sum
        },
        { impressions: 0, clicks: 0, spend: 0, conversions: 0, leads: 0, revenue: 0 }
      )
      const derived = deriveMetrics(totals)
      const status = String(campaign.effective_status || campaign.status || "UNKNOWN")
      const budget = Number(campaign.daily_budget || campaign.lifetime_budget || 0) / 100
      const saved = await prisma.campaign.upsert({
        where: { integrationId_externalId: { integrationId, externalId } },
        create: {
          integrationId,
          workspaceId: scope.workspaceId,
          userId,
          platform: "META",
          externalId,
          adAccountId: adAccountDbId,
          adAccountExternalId: externalAccountId,
          name: String(campaign.name || `Meta Campaign ${externalId}`),
          status,
          objective: campaign.objective || null,
          budgetAmount: budget || null,
          budgetCurrency: scope.currencyCode || null,
          impressions: totals.impressions,
          clicks: totals.clicks,
          spend: totals.spend,
          conversions: totals.conversions,
          revenue: totals.revenue,
          totalLeads: Math.round(totals.leads),
          ctr: derived.ctr,
          cpa: derived.cpa,
          roas: derived.roas,
          rawData: campaign,
          syncedAt: new Date(),
          isLive: true,
          liveStatus: status === "ACTIVE" ? "LIVE_ENABLED" : "LIVE_PAUSED",
          verifiedAt: new Date(),
        },
        update: {
          workspaceId: scope.workspaceId,
          userId,
          adAccountId: adAccountDbId,
          adAccountExternalId: externalAccountId,
          name: String(campaign.name || `Meta Campaign ${externalId}`),
          status,
          objective: campaign.objective || null,
          budgetAmount: budget || null,
          impressions: totals.impressions,
          clicks: totals.clicks,
          spend: totals.spend,
          conversions: totals.conversions,
          revenue: totals.revenue,
          totalLeads: Math.round(totals.leads),
          ctr: derived.ctr,
          cpa: derived.cpa,
          roas: derived.roas,
          rawData: campaign,
          syncedAt: new Date(),
          lastSeenAt: new Date(),
          isLive: true,
          liveStatus: status === "ACTIVE" ? "LIVE_ENABLED" : "LIVE_PAUSED",
          verifiedAt: new Date(),
          liveError: null,
        },
      })
      campaignIds.set(externalId, saved.id)

      await inChunks(dailyRows, async (row) => {
        if (!row.date_start) return
        const value = metrics(row)
        const metricDate = new Date(`${row.date_start}T00:00:00.000Z`)
        await prisma.campaignMetricDaily.upsert({
          where: { campaignId_metricDate: { campaignId: saved.id, metricDate } },
          create: { campaignId: saved.id, platform: "META", metricDate, impressions: value.impressions, clicks: value.clicks, spend: value.spend, conversions: value.conversions, revenue: value.revenue, ctr: value.ctr, cpa: value.cpa, roas: value.roas },
          update: { impressions: value.impressions, clicks: value.clicks, spend: value.spend, conversions: value.conversions, revenue: value.revenue, ctr: value.ctr, cpa: value.cpa, roas: value.roas },
        })
      })
    })

    const adGroupIds = new Map<string, string>()
    await inChunks(snapshot.adSets, async (adSet) => {
      const campaignId = campaignIds.get(String(adSet.campaign_id || ""))
      const externalId = String(adSet.id || "")
      if (!campaignId || !externalId) return
      const saved = await prisma.adGroup.upsert({
        where: { campaignId_externalId: { campaignId, externalId } },
        create: { userId, campaignId, externalId, name: String(adSet.name || "Meta Ad Set"), status: String(adSet.effective_status || adSet.status || "UNKNOWN"), isLive: true },
        update: { name: String(adSet.name || "Meta Ad Set"), status: String(adSet.effective_status || adSet.status || "UNKNOWN"), isLive: true },
      })
      adGroupIds.set(externalId, saved.id)
    })

    const adIds = new Map<string, string>()
    await inChunks(snapshot.ads, async (ad) => {
      const adGroupId = adGroupIds.get(String(ad.adset_id || ""))
      const externalId = String(ad.id || "")
      if (!adGroupId || !externalId) return
      const creative = ad.creative || {}
      const story = creative.object_story_spec || {}
      const finalUrl = story.link_data?.link || story.video_data?.call_to_action?.value?.link || ""
      const saved = await prisma.ad.upsert({
        where: { adGroupId_externalId: { adGroupId, externalId } },
        create: { userId, adGroupId, externalId, headlines: [{ text: creative.title || ad.name || "Meta Ad" }], descriptions: [{ text: creative.body || "" }], finalUrl, status: String(ad.effective_status || ad.status || "UNKNOWN"), isLive: true },
        update: { headlines: [{ text: creative.title || ad.name || "Meta Ad" }], descriptions: [{ text: creative.body || "" }], finalUrl, status: String(ad.effective_status || ad.status || "UNKNOWN"), isLive: true },
      })
      adIds.set(externalId, saved.id)
    })

    await inChunks(snapshot.adInsights, async (row) => {
      const adId = adIds.get(String(row.ad_id || ""))
      if (!adId || !row.date_start) return
      const value = metrics(row)
      const metricDate = new Date(`${row.date_start}T00:00:00.000Z`)
      await prisma.adMetricDaily.upsert({
        where: { adId_metricDate: { adId, metricDate } },
        create: { adId, metricDate, impressions: value.impressions, clicks: value.clicks, spend: value.spend, conversions: value.conversions, revenue: value.revenue, ctr: value.ctr, cpa: value.cpa, roas: value.roas },
        update: { impressions: value.impressions, clicks: value.clicks, spend: value.spend, conversions: value.conversions, revenue: value.revenue, ctr: value.ctr, cpa: value.cpa, roas: value.roas },
      })
    })

    const syncedAt = new Date()
    await prisma.adAccount.update({ where: { id: adAccountDbId }, data: { lastSyncedAt: syncedAt, syncStatus: "SYNCED", syncError: null } })
    await prisma.integration.update({
      where: { id: integrationId },
      data: { status: "ACTIVE", lastSyncAt: syncedAt, lastSyncedAt: syncedAt, lastSyncStatus: "SUCCESS", syncStatus: "SYNCED", lastSyncError: null, hasAdsAccess: true },
    })
    return campaignIds.size
  } catch (error: any) {
    reportError(error, "sync/meta", { userId, integrationId, adAccountDbId })
    await prisma.adAccount.update({ where: { id: adAccountDbId }, data: { syncStatus: "ERROR", syncError: error?.message || "Meta sync failed" } })
    await prisma.integration.update({ where: { id: integrationId }, data: { status: "SYNC_FAILED", lastSyncStatus: "FAILED", syncStatus: "ERROR", lastSyncError: error?.message || "Meta sync failed" } })
    throw error
  }
}

export async function syncMetaIntegration(integration: any) {
  if (integration.platform !== "META") return 0
  const accessToken = getIntegrationAccessToken(integration)
  if (!accessToken || !integration.selectedAdAccountId) throw new Error("Missing Meta access token or selected ad account")
  const account = await prisma.adAccount.findFirst({
    where: { integrationId: integration.id, externalId: integration.selectedAdAccountId },
    select: { id: true, externalId: true },
  })
  if (!account) throw new Error("Selected Meta ad account metadata not found")
  return syncMetaAdsCampaigns(integration.userId, integration.id, account.id, account.externalId, accessToken)
}
