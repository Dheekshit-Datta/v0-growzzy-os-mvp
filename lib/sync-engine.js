var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { prisma } from "@/lib/prisma";
import { deriveMetrics } from "@/lib/metrics";
import { GoogleAdsService } from "@/services/integrations/google";
import { refreshGoogleAccessToken } from "@/lib/ads-detection";
import { log, reportError } from "@/lib/logger";
import { encryptedIntegrationTokens, getIntegrationAccessToken, getIntegrationRefreshToken } from "@/lib/integration-tokens";
import { generateAndPersistRecommendations } from "@/lib/ai-recommendation-engine";
import { MetaAdsService, parseMetaInsight } from "@/services/integrations/meta";
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export function fetchWithRetry(url_1, options_1) {
    return __awaiter(this, arguments, void 0, function* (url, options, maxRetries = 3, timeoutMs = 15000) {
        let lastError = new Error("Request failed");
        for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const response = yield fetch(url, Object.assign(Object.assign({}, options), { signal: controller.signal }));
                clearTimeout(timeout);
                if (response.status === 429 && attempt < maxRetries) {
                    const retryAfter = Number(response.headers.get("Retry-After") || "2") * 1000;
                    yield sleep(retryAfter);
                    continue;
                }
                if (response.status === 401 || response.status === 403) {
                    throw new Error(`Auth error: ${response.status}`);
                }
                return response;
            }
            catch (error) {
                clearTimeout(timeout);
                lastError = error;
                if (attempt < maxRetries)
                    yield sleep(Math.pow(2, attempt - 1) * 1000);
            }
        }
        throw lastError;
    });
}
function acquireSyncLock(userId, adAccountDbId) {
    return __awaiter(this, void 0, void 0, function* () {
        const recentSync = yield prisma.adAccount.findFirst({
            where: {
                userId,
                syncStatus: "SYNCING",
                updatedAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
            },
            select: { id: true },
        });
        if (recentSync && recentSync.id !== adAccountDbId)
            return false;
        yield prisma.adAccount.update({
            where: { id: adAccountDbId },
            data: { syncStatus: "SYNCING", syncError: null },
        });
        return true;
    });
}
export function ensureFreshGoogleToken(integrationId, currentAccessToken) {
    return __awaiter(this, void 0, void 0, function* () {
        const integration = yield prisma.integration.findUnique({
            where: { id: integrationId },
            select: { refreshTokenEncrypted: true, tokenExpiresAt: true, expiresAt: true },
        });
        const refreshToken = integration ? getIntegrationRefreshToken(integration) : null;
        if (!refreshToken)
            return currentAccessToken;
        const expiresAt = (integration === null || integration === void 0 ? void 0 : integration.tokenExpiresAt) || (integration === null || integration === void 0 ? void 0 : integration.expiresAt);
        if (!expiresAt)
            return currentAccessToken;
        if (expiresAt.getTime() > Date.now() + 10 * 60 * 1000)
            return currentAccessToken;
        const refreshed = yield refreshGoogleAccessToken(refreshToken);
        yield prisma.integration.update({
            where: { id: integrationId },
            data: Object.assign(Object.assign({}, encryptedIntegrationTokens(refreshed.accessToken)), { expiresAt: refreshed.expiresAt, tokenExpiresAt: refreshed.expiresAt }),
        });
        return refreshed.accessToken;
    });
}
export function syncGoogleAdsCampaigns(userId, integrationId, adAccountDbId, externalAccountId, accessToken, managerCustomerId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12;
        const hasLock = yield acquireSyncLock(userId, adAccountDbId);
        if (!hasLock) {
            log("warn", "sync/google", "Sync skipped because another sync is already in progress", { userId, adAccountDbId });
            return 0;
        }
        const resolvedAccessToken = yield ensureFreshGoogleToken(integrationId, accessToken);
        const syncScope = yield prisma.adAccount.findUnique({
            where: { id: adAccountDbId },
            select: { workspaceId: true },
        });
        const workspaceId = (syncScope === null || syncScope === void 0 ? void 0 : syncScope.workspaceId) ||
            ((_a = (yield prisma.integration.findUnique({ where: { id: integrationId }, select: { workspaceId: true } }))) === null || _a === void 0 ? void 0 : _a.workspaceId) ||
            null;
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
    WHERE campaign.status != 'REMOVED'
    LIMIT 200
  `;
        const preferredLoginCustomerId = managerCustomerId || externalAccountId;
        try {
            const streamData = yield GoogleAdsService.searchStream({
                accessToken: resolvedAccessToken,
                customerId: externalAccountId,
                query,
                loginCustomerId: preferredLoginCustomerId,
            });
            const rows = Array.isArray(streamData) ? streamData.flatMap((chunk) => { var _a; return (_a = chunk.results) !== null && _a !== void 0 ? _a : []; }) : [];
            const errors = [];
            let syncedCampaigns = 0;
            const localCampaignIdByExternalId = new Map();
            for (const row of rows) {
                const campaign = row.campaign || {};
                const metrics = row.metrics || {};
                const campaignBudget = row.campaignBudget || {};
                try {
                    const spend = metrics.costMicros ? Number(metrics.costMicros) / 1000000 : 0;
                    const clicks = Number((_b = metrics.clicks) !== null && _b !== void 0 ? _b : 0);
                    const impressions = Number((_c = metrics.impressions) !== null && _c !== void 0 ? _c : 0);
                    const conversions = Number((_d = metrics.conversions) !== null && _d !== void 0 ? _d : 0);
                    const revenue = Number((_e = metrics.conversionsValue) !== null && _e !== void 0 ? _e : 0);
                    const budgetAmount = campaignBudget.amountMicros ? Number(campaignBudget.amountMicros) / 1000000 : null;
                    const cpcVal = metrics.averageCpc ? Number(metrics.averageCpc) / 1000000 : null;
                    const derived = deriveMetrics({ spend, clicks, impressions, conversions, revenue });
                    const upserted = yield prisma.campaign.upsert({
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
                    });
                    localCampaignIdByExternalId.set(String(campaign.id), upserted.id);
                    syncedCampaigns += 1;
                }
                catch (error) {
                    errors.push(`Campaign ${campaign.id || "unknown"}: ${(error === null || error === void 0 ? void 0 : error.message) || "Unknown error"}`);
                }
            }
            if (localCampaignIdByExternalId.size > 0) {
                try {
                    const todayUtc = new Date().toISOString().slice(0, 10);
                    const todaySpendByCampaign = new Map();
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
        `;
                    const dailyStreamData = yield GoogleAdsService.searchStream({
                        accessToken: resolvedAccessToken,
                        customerId: externalAccountId,
                        query: dailyQuery,
                        loginCustomerId: preferredLoginCustomerId,
                    });
                    const dailyRows = Array.isArray(dailyStreamData) ? dailyStreamData.flatMap((chunk) => { var _a; return (_a = chunk.results) !== null && _a !== void 0 ? _a : []; }) : [];
                    for (const row of dailyRows) {
                        const externalCampaignId = String(((_f = row.campaign) === null || _f === void 0 ? void 0 : _f.id) || "");
                        const localCampaignId = localCampaignIdByExternalId.get(externalCampaignId);
                        const dateStr = (_g = row.segments) === null || _g === void 0 ? void 0 : _g.date;
                        if (!localCampaignId || !dateStr)
                            continue;
                        const metricDate = new Date(`${dateStr}T00:00:00.000Z`);
                        const metrics = row.metrics || {};
                        const spend = metrics.costMicros ? Number(metrics.costMicros) / 1000000 : 0;
                        const clicks = Number((_h = metrics.clicks) !== null && _h !== void 0 ? _h : 0);
                        const impressions = Number((_j = metrics.impressions) !== null && _j !== void 0 ? _j : 0);
                        const conversions = Number((_k = metrics.conversions) !== null && _k !== void 0 ? _k : 0);
                        const revenue = Number((_l = metrics.conversionsValue) !== null && _l !== void 0 ? _l : 0);
                        const derived = deriveMetrics({ spend, clicks, impressions, conversions, revenue });
                        yield prisma.campaignMetricDaily.upsert({
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
                        });
                        if (dateStr === todayUtc)
                            todaySpendByCampaign.set(localCampaignId, spend);
                    }
                    // ponytail: one persisted alert per campaign/day; move to a scheduler if sync frequency needs sub-minute pacing.
                    if (workspaceId && todaySpendByCampaign.size) {
                        const campaigns = yield prisma.campaign.findMany({
                            where: { id: { in: [...todaySpendByCampaign.keys()] }, workspaceId },
                            select: { id: true, name: true, budgetAmount: true, dailyBudget: true },
                        });
                        for (const campaign of campaigns) {
                            const dailyBudget = Number((_o = (_m = campaign.dailyBudget) !== null && _m !== void 0 ? _m : campaign.budgetAmount) !== null && _o !== void 0 ? _o : 0);
                            const spendToday = todaySpendByCampaign.get(campaign.id) || 0;
                            if (!dailyBudget || spendToday <= 0)
                                continue;
                            const hour = new Date().getUTCHours() + new Date().getUTCMinutes() / 60;
                            const projectedDailySpend = spendToday / Math.max(hour / 24, 1 / 24);
                            if (projectedDailySpend < dailyBudget * 0.9)
                                continue;
                            const sourceEntityId = `pacing:${campaign.id}:${todayUtc}`;
                            const existing = yield prisma.optimizationSuggestion.findFirst({ where: { workspaceId, sourceEntityId } });
                            if (!existing) {
                                yield prisma.optimizationSuggestion.create({
                                    data: {
                                        workspaceId,
                                        userId,
                                        campaignId: campaign.id,
                                        sourceEntityId,
                                        sourceType: "SYNC_PACING",
                                        insightType: "pacing_alert",
                                        actionType: "BUDGET_DECREASE",
                                        recommendedValue: String(Math.max(1, Math.round(dailyBudget * 0.8 * 100) / 100)),
                                        title: `Review pacing for ${campaign.name}`,
                                        message: `Projected spend is $${projectedDailySpend.toFixed(2)}/day against a $${dailyBudget.toFixed(2)} budget. Review delivery before enabling more spend.`,
                                        confidence: 90,
                                        evidence: { spendToday, dailyBudget, projectedDailySpend, metricDate: todayUtc },
                                    },
                                });
                            }
                        }
                    }
                }
                catch (dailyError) {
                    // Non-fatal - the aggregate campaign sync above already succeeded and
                    // is what the rest of the app depends on; trend detection just won't
                    // have fresh data until the next successful sync.
                    log("warn", "sync/google", "Daily metric sync failed", { userId, adAccountDbId, message: dailyError === null || dailyError === void 0 ? void 0 : dailyError.message });
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
        `;
                    const creativeStreamData = yield GoogleAdsService.searchStream({
                        accessToken: resolvedAccessToken,
                        customerId: externalAccountId,
                        query: creativeQuery,
                        loginCustomerId: preferredLoginCustomerId,
                    });
                    const creativeRows = Array.isArray(creativeStreamData) ? creativeStreamData.flatMap((chunk) => { var _a; return (_a = chunk.results) !== null && _a !== void 0 ? _a : []; }) : [];
                    const localAdIdByExternalId = new Map();
                    for (const row of creativeRows) {
                        const externalCampaignId = String(((_p = row.campaign) === null || _p === void 0 ? void 0 : _p.id) || "");
                        const localCampaignId = localCampaignIdByExternalId.get(externalCampaignId);
                        const externalAdGroupId = String(((_q = row.adGroup) === null || _q === void 0 ? void 0 : _q.id) || "");
                        const externalAdId = String(((_s = (_r = row.adGroupAd) === null || _r === void 0 ? void 0 : _r.ad) === null || _s === void 0 ? void 0 : _s.id) || "");
                        const dateStr = (_t = row.segments) === null || _t === void 0 ? void 0 : _t.date;
                        if (!localCampaignId || !externalAdGroupId || !externalAdId || !dateStr)
                            continue;
                        const cacheKey = `${externalAdGroupId}:${externalAdId}`;
                        let localAdId = localAdIdByExternalId.get(cacheKey);
                        if (!localAdId) {
                            const localAdGroup = yield prisma.adGroup.upsert({
                                where: { campaignId_externalId: { campaignId: localCampaignId, externalId: externalAdGroupId } },
                                create: { userId, campaignId: localCampaignId, externalId: externalAdGroupId, name: ((_u = row.adGroup) === null || _u === void 0 ? void 0 : _u.name) || "Ad Group", isLive: true },
                                update: { name: ((_v = row.adGroup) === null || _v === void 0 ? void 0 : _v.name) || "Ad Group" },
                            });
                            const headlines = (((_y = (_x = (_w = row.adGroupAd) === null || _w === void 0 ? void 0 : _w.ad) === null || _x === void 0 ? void 0 : _x.responsiveSearchAd) === null || _y === void 0 ? void 0 : _y.headlines) || []).map((h) => ({ text: (h === null || h === void 0 ? void 0 : h.text) || "" })).filter((h) => h.text);
                            const descriptions = (((_1 = (_0 = (_z = row.adGroupAd) === null || _z === void 0 ? void 0 : _z.ad) === null || _0 === void 0 ? void 0 : _0.responsiveSearchAd) === null || _1 === void 0 ? void 0 : _1.descriptions) || []).map((d) => ({ text: (d === null || d === void 0 ? void 0 : d.text) || "" })).filter((d) => d.text);
                            const finalUrl = (((_3 = (_2 = row.adGroupAd) === null || _2 === void 0 ? void 0 : _2.ad) === null || _3 === void 0 ? void 0 : _3.finalUrls) || [])[0] || "";
                            const status = ((_4 = row.adGroupAd) === null || _4 === void 0 ? void 0 : _4.status) || "ENABLED";
                            const localAd = yield prisma.ad.upsert({
                                where: { adGroupId_externalId: { adGroupId: localAdGroup.id, externalId: externalAdId } },
                                create: {
                                    userId,
                                    adGroupId: localAdGroup.id,
                                    externalId: externalAdId,
                                    resourceName: ((_6 = (_5 = row.adGroupAd) === null || _5 === void 0 ? void 0 : _5.ad) === null || _6 === void 0 ? void 0 : _6.resourceName) || null,
                                    headlines: headlines.length ? headlines : [{ text: "(no headlines synced)" }],
                                    descriptions: descriptions.length ? descriptions : [{ text: "(no descriptions synced)" }],
                                    finalUrl,
                                    status,
                                    isLive: true,
                                },
                                update: Object.assign(Object.assign(Object.assign(Object.assign({ resourceName: ((_8 = (_7 = row.adGroupAd) === null || _7 === void 0 ? void 0 : _7.ad) === null || _8 === void 0 ? void 0 : _8.resourceName) || null }, (headlines.length ? { headlines } : {})), (descriptions.length ? { descriptions } : {})), (finalUrl ? { finalUrl } : {})), { status }),
                            });
                            localAdId = localAd.id;
                            localAdIdByExternalId.set(cacheKey, localAdId);
                        }
                        const metricDate = new Date(`${dateStr}T00:00:00.000Z`);
                        const metrics = row.metrics || {};
                        const spend = metrics.costMicros ? Number(metrics.costMicros) / 1000000 : 0;
                        const clicks = Number((_9 = metrics.clicks) !== null && _9 !== void 0 ? _9 : 0);
                        const impressions = Number((_10 = metrics.impressions) !== null && _10 !== void 0 ? _10 : 0);
                        const conversions = Number((_11 = metrics.conversions) !== null && _11 !== void 0 ? _11 : 0);
                        const revenue = Number((_12 = metrics.conversionsValue) !== null && _12 !== void 0 ? _12 : 0);
                        const derived = deriveMetrics({ spend, clicks, impressions, conversions, revenue });
                        yield prisma.adMetricDaily.upsert({
                            where: { adId_metricDate: { adId: localAdId, metricDate } },
                            create: { adId: localAdId, metricDate, impressions, clicks, spend, conversions, revenue, ctr: derived.ctr, cpa: derived.cpa, roas: derived.roas },
                            update: { impressions, clicks, spend, conversions, revenue, ctr: derived.ctr, cpa: derived.cpa, roas: derived.roas },
                        });
                    }
                }
                catch (creativeError) {
                    // Non-fatal for the same reason as the daily-metric sync above -
                    // creative testing data just won't refresh until the next sync.
                    log("warn", "sync/google", "Ad-level creative sync failed", { userId, adAccountDbId, message: creativeError === null || creativeError === void 0 ? void 0 : creativeError.message });
                }
            }
            const partialError = rows.length > 0 && errors.length >= rows.length / 2;
            const syncStatus = partialError ? "PARTIAL_ERROR" : "SYNCED";
            const syncError = errors.length ? errors.slice(0, 10).join("\n") : null;
            yield prisma.adAccount.update({
                where: { id: adAccountDbId },
                data: { lastSyncedAt: new Date(), syncStatus, syncError },
            });
            yield prisma.integration.update({
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
            });
            if (errors.length) {
                log("warn", "sync/google", "Google sync completed with row-level errors", { userId, adAccountDbId, errorCount: errors.length });
            }
            if (workspaceId && syncedCampaigns > 0) {
                generateAndPersistRecommendations({ userId, workspaceId }).catch((recError) => log("error", "sync/google", "Recommendation generation after sync failed", { message: recError === null || recError === void 0 ? void 0 : recError.message }));
            }
            return syncedCampaigns;
        }
        catch (error) {
            reportError(error, "sync/google", { userId, workspaceId, integrationId, adAccountDbId });
            yield prisma.adAccount.update({
                where: { id: adAccountDbId },
                data: { syncStatus: "ERROR", syncError: (error === null || error === void 0 ? void 0 : error.message) || "Google sync failed" },
            });
            throw error;
        }
    });
}
export function syncGoogleIntegration(integration) {
    return __awaiter(this, void 0, void 0, function* () {
        if (integration.platform !== "GOOGLE")
            return 0;
        const accessToken = getIntegrationAccessToken(integration);
        if (!accessToken || !integration.selectedAdAccountId) {
            throw new Error("Missing Google access token or selected ad account");
        }
        const selectedAccount = yield prisma.adAccount.findFirst({
            where: {
                integrationId: integration.id,
                externalId: integration.selectedAdAccountId,
            },
            select: {
                id: true,
                externalId: true,
                managerCustomerId: true,
            },
        });
        if (!selectedAccount) {
            throw new Error("Selected Google ad account metadata not found");
        }
        return syncGoogleAdsCampaigns(integration.userId, integration.id, selectedAccount.id, selectedAccount.externalId, accessToken, selectedAccount.managerCustomerId);
    });
}
export function syncMetaAdsCampaigns(userId, integrationId, adAccountDbId, externalAccountId, accessToken) {
    return __awaiter(this, void 0, void 0, function* () {
        const hasLock = yield acquireSyncLock(userId, adAccountDbId);
        if (!hasLock)
            return 0;
        const scope = yield prisma.adAccount.findFirst({
            where: { id: adAccountDbId, integrationId, externalId: externalAccountId, userId },
            select: { workspaceId: true, currencyCode: true },
        });
        if (!scope)
            throw new Error("Selected Meta ad account does not belong to this integration");
        const metrics = (row) => {
            const parsed = parseMetaInsight(row);
            return Object.assign(Object.assign({}, parsed), deriveMetrics(parsed));
        };
        const inChunks = (rows_1, work_1, ...args_1) => __awaiter(this, [rows_1, work_1, ...args_1], void 0, function* (rows, work, size = 25) {
            for (let index = 0; index < rows.length; index += size)
                yield Promise.all(rows.slice(index, index + size).map(work));
        });
        try {
            const snapshot = yield MetaAdsService.readAccountSnapshot(accessToken, externalAccountId);
            const insightByCampaign = new Map();
            for (const row of snapshot.campaignInsights) {
                const key = String(row.campaign_id || "");
                if (key)
                    insightByCampaign.set(key, [...(insightByCampaign.get(key) || []), row]);
            }
            const campaignIds = new Map();
            yield inChunks(snapshot.campaigns, (campaign) => __awaiter(this, void 0, void 0, function* () {
                const externalId = String(campaign.id || "");
                if (!externalId)
                    return;
                const dailyRows = insightByCampaign.get(externalId) || [];
                const totals = dailyRows.reduce((sum, row) => {
                    const value = metrics(row);
                    sum.impressions += value.impressions;
                    sum.clicks += value.clicks;
                    sum.spend += value.spend;
                    sum.conversions += value.conversions;
                    sum.leads += value.leads;
                    sum.revenue += value.revenue;
                    return sum;
                }, { impressions: 0, clicks: 0, spend: 0, conversions: 0, leads: 0, revenue: 0 });
                const derived = deriveMetrics(totals);
                const status = String(campaign.effective_status || campaign.status || "UNKNOWN");
                const budget = Number(campaign.daily_budget || campaign.lifetime_budget || 0) / 100;
                const saved = yield prisma.campaign.upsert({
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
                });
                campaignIds.set(externalId, saved.id);
                yield inChunks(dailyRows, (row) => __awaiter(this, void 0, void 0, function* () {
                    if (!row.date_start)
                        return;
                    const value = metrics(row);
                    const metricDate = new Date(`${row.date_start}T00:00:00.000Z`);
                    yield prisma.campaignMetricDaily.upsert({
                        where: { campaignId_metricDate: { campaignId: saved.id, metricDate } },
                        create: { campaignId: saved.id, platform: "META", metricDate, impressions: value.impressions, clicks: value.clicks, spend: value.spend, conversions: value.conversions, revenue: value.revenue, ctr: value.ctr, cpa: value.cpa, roas: value.roas },
                        update: { impressions: value.impressions, clicks: value.clicks, spend: value.spend, conversions: value.conversions, revenue: value.revenue, ctr: value.ctr, cpa: value.cpa, roas: value.roas },
                    });
                }));
            }));
            const adGroupIds = new Map();
            yield inChunks(snapshot.adSets, (adSet) => __awaiter(this, void 0, void 0, function* () {
                const campaignId = campaignIds.get(String(adSet.campaign_id || ""));
                const externalId = String(adSet.id || "");
                if (!campaignId || !externalId)
                    return;
                const saved = yield prisma.adGroup.upsert({
                    where: { campaignId_externalId: { campaignId, externalId } },
                    create: { userId, campaignId, externalId, name: String(adSet.name || "Meta Ad Set"), status: String(adSet.effective_status || adSet.status || "UNKNOWN"), isLive: true },
                    update: { name: String(adSet.name || "Meta Ad Set"), status: String(adSet.effective_status || adSet.status || "UNKNOWN"), isLive: true },
                });
                adGroupIds.set(externalId, saved.id);
            }));
            const adIds = new Map();
            yield inChunks(snapshot.ads, (ad) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c, _d;
                const adGroupId = adGroupIds.get(String(ad.adset_id || ""));
                const externalId = String(ad.id || "");
                if (!adGroupId || !externalId)
                    return;
                const creative = ad.creative || {};
                const story = creative.object_story_spec || {};
                const finalUrl = ((_a = story.link_data) === null || _a === void 0 ? void 0 : _a.link) || ((_d = (_c = (_b = story.video_data) === null || _b === void 0 ? void 0 : _b.call_to_action) === null || _c === void 0 ? void 0 : _c.value) === null || _d === void 0 ? void 0 : _d.link) || "";
                const saved = yield prisma.ad.upsert({
                    where: { adGroupId_externalId: { adGroupId, externalId } },
                    create: { userId, adGroupId, externalId, headlines: [{ text: creative.title || ad.name || "Meta Ad" }], descriptions: [{ text: creative.body || "" }], finalUrl, status: String(ad.effective_status || ad.status || "UNKNOWN"), isLive: true },
                    update: { headlines: [{ text: creative.title || ad.name || "Meta Ad" }], descriptions: [{ text: creative.body || "" }], finalUrl, status: String(ad.effective_status || ad.status || "UNKNOWN"), isLive: true },
                });
                adIds.set(externalId, saved.id);
            }));
            yield inChunks(snapshot.adInsights, (row) => __awaiter(this, void 0, void 0, function* () {
                const adId = adIds.get(String(row.ad_id || ""));
                if (!adId || !row.date_start)
                    return;
                const value = metrics(row);
                const metricDate = new Date(`${row.date_start}T00:00:00.000Z`);
                yield prisma.adMetricDaily.upsert({
                    where: { adId_metricDate: { adId, metricDate } },
                    create: { adId, metricDate, impressions: value.impressions, clicks: value.clicks, spend: value.spend, conversions: value.conversions, revenue: value.revenue, ctr: value.ctr, cpa: value.cpa, roas: value.roas },
                    update: { impressions: value.impressions, clicks: value.clicks, spend: value.spend, conversions: value.conversions, revenue: value.revenue, ctr: value.ctr, cpa: value.cpa, roas: value.roas },
                });
            }));
            const syncedAt = new Date();
            yield prisma.adAccount.update({ where: { id: adAccountDbId }, data: { lastSyncedAt: syncedAt, syncStatus: "SYNCED", syncError: null } });
            yield prisma.integration.update({
                where: { id: integrationId },
                data: { status: "ACTIVE", lastSyncAt: syncedAt, lastSyncedAt: syncedAt, lastSyncStatus: "SUCCESS", syncStatus: "SYNCED", lastSyncError: null, hasAdsAccess: true },
            });
            return campaignIds.size;
        }
        catch (error) {
            reportError(error, "sync/meta", { userId, integrationId, adAccountDbId });
            yield prisma.adAccount.update({ where: { id: adAccountDbId }, data: { syncStatus: "ERROR", syncError: (error === null || error === void 0 ? void 0 : error.message) || "Meta sync failed" } });
            yield prisma.integration.update({ where: { id: integrationId }, data: { status: "SYNC_FAILED", lastSyncStatus: "FAILED", syncStatus: "ERROR", lastSyncError: (error === null || error === void 0 ? void 0 : error.message) || "Meta sync failed" } });
            throw error;
        }
    });
}
export function syncMetaIntegration(integration) {
    return __awaiter(this, void 0, void 0, function* () {
        if (integration.platform !== "META")
            return 0;
        const accessToken = getIntegrationAccessToken(integration);
        if (!accessToken || !integration.selectedAdAccountId)
            throw new Error("Missing Meta access token or selected ad account");
        const account = yield prisma.adAccount.findFirst({
            where: { integrationId: integration.id, externalId: integration.selectedAdAccountId },
            select: { id: true, externalId: true },
        });
        if (!account)
            throw new Error("Selected Meta ad account metadata not found");
        return syncMetaAdsCampaigns(integration.userId, integration.id, account.id, account.externalId, accessToken);
    });
}
