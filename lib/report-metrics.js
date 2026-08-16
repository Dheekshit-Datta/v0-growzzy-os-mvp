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
import { verifiedMetricCampaignWhere } from "@/lib/data-trust";
export function calculateReportMetrics(userId, dateRange, scope) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(scope === null || scope === void 0 ? void 0 : scope.workspaceId)) {
            throw new Error("A workspace is required to generate a report.");
        }
        const integrations = yield prisma.integration.findMany({
            where: { userId, workspaceId: scope.workspaceId, status: { in: ["OAUTH_GRANTED", "ACCOUNT_SELECTED", "INITIAL_SYNC_RUNNING", "ACTIVE", "SYNC_FAILED"] }, hasAdsAccess: true },
            select: { selectedAdAccountId: true, accountId: true },
        });
        const activeAccountIds = integrations.map((integration) => integration.selectedAdAccountId || integration.accountId).filter(Boolean);
        if (scope.adAccountId && !activeAccountIds.includes(scope.adAccountId)) {
            throw new Error("The selected ad account is not active in this workspace.");
        }
        const permittedAccountIds = scope.adAccountId ? [scope.adAccountId] : activeAccountIds;
        if (!permittedAccountIds.length) {
            throw new Error("No verified selected ad account is available for this report.");
        }
        const campaigns = yield prisma.campaign.findMany({
            where: Object.assign(Object.assign({}, verifiedMetricCampaignWhere({ userId, workspaceId: scope === null || scope === void 0 ? void 0 : scope.workspaceId })), { adAccountId: { in: permittedAccountIds }, metricsDaily: { some: { metricDate: { gte: dateRange.from, lte: dateRange.to } } } }),
            include: { metricsDaily: { where: { metricDate: { gte: dateRange.from, lte: dateRange.to } } } },
            orderBy: {
                totalRevenue: 'desc',
            },
        });
        if (!campaigns || campaigns.length === 0) {
            throw new Error("No verified synced campaign data exists in the selected report period.");
        }
        const spendFor = (campaign) => campaign.metricsDaily.reduce((sum, metric) => sum + Number(metric.spend || 0), 0);
        const revenueFor = (campaign) => campaign.metricsDaily.reduce((sum, metric) => sum + Number(metric.revenue || 0), 0);
        const conversionsFor = (campaign) => campaign.metricsDaily.reduce((sum, metric) => sum + Number(metric.conversions || 0), 0);
        const clicksFor = (campaign) => campaign.metricsDaily.reduce((sum, metric) => sum + Number(metric.clicks || 0), 0);
        const impressionsFor = (campaign) => campaign.metricsDaily.reduce((sum, metric) => sum + Number(metric.impressions || 0), 0);
        const roasFor = (campaign) => {
            const spend = spendFor(campaign);
            return spend > 0 ? revenueFor(campaign) / spend : 0;
        };
        const totalSpend = campaigns.reduce((sum, c) => sum + spendFor(c), 0);
        const totalRevenue = campaigns.reduce((sum, c) => sum + revenueFor(c), 0);
        const totalImpressions = campaigns.reduce((sum, c) => sum + impressionsFor(c), 0);
        const totalClicks = campaigns.reduce((sum, c) => sum + clicksFor(c), 0);
        const totalConversions = campaigns.reduce((sum, c) => sum + conversionsFor(c), 0);
        const averageROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;
        const averageCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
        const averageCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;
        const averageCPA = totalConversions > 0 ? totalSpend / totalConversions : 0;
        // Calculate platform breakdown
        const platformBreakdown = {};
        campaigns.forEach((campaign) => {
            const platformName = String(campaign.platformName || campaign.platform || 'other');
            if (!platformBreakdown[platformName]) {
                platformBreakdown[platformName] = {
                    spend: 0,
                    revenue: 0,
                    roas: 0,
                    count: 0,
                };
            }
            const pb = platformBreakdown[platformName];
            pb.spend += spendFor(campaign);
            pb.revenue += revenueFor(campaign);
            pb.count += 1;
        });
        // Calculate platform ROAS
        Object.keys(platformBreakdown).forEach((platform) => {
            const pb = platformBreakdown[platform];
            pb.roas = pb.spend > 0 ? pb.revenue / pb.spend : 0;
        });
        // Get top and bottom campaigns
        const rankedCampaigns = [...campaigns].sort((a, b) => revenueFor(b) - revenueFor(a));
        const topCampaigns = rankedCampaigns.slice(0, 5);
        const bottomCampaigns = rankedCampaigns.slice(-5).reverse();
        const mapCampaign = (c) => {
            const spend = spendFor(c);
            const impressions = impressionsFor(c);
            const clicks = clicksFor(c);
            const conversions = conversionsFor(c);
            return {
                id: c.id,
                name: c.name,
                platform: String(c.platformName || c.platform || 'other'),
                spend,
                revenue: revenueFor(c),
                clicks,
                impressions,
                conversions,
                ctr: Number(c.ctr || (impressions > 0 ? (clicks / impressions) * 100 : 0)),
                roas: roasFor(c),
                status: c.status,
                created_at: c.createdAt,
                updated_at: c.updatedAt,
            };
        };
        return {
            dateRange,
            totalSpend,
            totalRevenue,
            totalImpressions,
            totalClicks,
            totalConversions,
            averageROAS,
            averageCTR,
            averageCPC,
            averageCPA,
            campaigns: campaigns.map(mapCampaign),
            topCampaigns: topCampaigns.map(mapCampaign),
            bottomCampaigns: bottomCampaigns.map(mapCampaign),
            platformBreakdown,
        };
    });
}
