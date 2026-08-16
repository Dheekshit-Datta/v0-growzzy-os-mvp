const UNVERIFIED_EXTERNAL_PREFIXES = ["local-", "google-seed-", "mock-", "mock_", "demo-", "demo_"];
const DEMO_CAMPAIGN_NAMES = [
    "Growzzy Marketing",
    "Summer Sale 2025",
    "Brand Awareness Campaign",
    "Retargeting Campaign",
    "Product Launch Campaign",
    "Lead Generation Campaign",
    "Local Store Visits",
];
const DEMO_CAMPAIGN_NAME_PREFIXES = ["demo ", "sample ", "test campaign ", "seed "];
export function unverifiedCampaignWhere() {
    return {
        OR: [
            ...UNVERIFIED_EXTERNAL_PREFIXES.map((prefix) => ({ externalId: { startsWith: prefix } })),
            { name: { in: DEMO_CAMPAIGN_NAMES } },
            ...DEMO_CAMPAIGN_NAME_PREFIXES.map((prefix) => ({ name: { startsWith: prefix, mode: "insensitive" } })),
        ],
    };
}
export function verifiedCampaignWhere(input) {
    return Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ userId: input.userId }, (input.workspaceId ? { workspaceId: input.workspaceId } : {})), (input.integrationId ? { integrationId: input.integrationId } : {})), (input.adAccountId ? { adAccountId: input.adAccountId } : {})), (input.platform ? { platform: input.platform } : {})), { isLive: true, integration: Object.assign({ userId: input.userId, hasAdsAccess: true, status: { in: ["OAUTH_GRANTED", "ACCOUNT_SELECTED", "INITIAL_SYNC_RUNNING", "ACTIVE", "SYNC_FAILED"] } }, (input.workspaceId ? { workspaceId: input.workspaceId } : {})), NOT: unverifiedCampaignWhere() });
}
export function verifiedMetricCampaignWhere(input) {
    return Object.assign(Object.assign({}, verifiedCampaignWhere(input)), { OR: [
            { spend: { gt: 0 } },
            { impressions: { gt: 0 } },
            { clicks: { gt: 0 } },
            { conversions: { gt: 0 } },
            { revenue: { gt: 0 } },
            { totalSpend: { gt: 0 } },
            { totalConversions: { gt: 0 } },
            { totalRevenue: { gt: 0 } },
            { metricsDaily: { some: { OR: [{ spend: { gt: 0 } }, { impressions: { gt: 0 } }, { clicks: { gt: 0 } }, { conversions: { gt: 0 } }, { revenue: { gt: 0 } }] } } },
        ] });
}
export function isUnverifiedExternalId(externalId) {
    const value = String(externalId || "");
    return !value || UNVERIFIED_EXTERNAL_PREFIXES.some((prefix) => value.startsWith(prefix));
}
export function hasVerifiedMetrics(campaign) {
    return [
        campaign.spend,
        campaign.totalSpend,
        campaign.impressions,
        campaign.clicks,
        campaign.conversions,
        campaign.totalConversions,
        campaign.revenue,
        campaign.totalRevenue,
    ].some((value) => Number(value || 0) > 0);
}
