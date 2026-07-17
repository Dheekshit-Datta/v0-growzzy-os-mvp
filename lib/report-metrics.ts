import { prisma } from "@/lib/prisma";
import { verifiedMetricCampaignWhere } from "@/lib/data-trust";

export interface CampaignData {
  id: string;
  name: string;
  platform: string;
  spend: number;
  revenue: number;
  clicks: number;
  impressions: number;
  conversions: number;
  ctr: number;
  roas: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface ReportMetrics {
  dateRange: { from: Date; to: Date };
  totalSpend: number;
  totalRevenue: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  averageROAS: number;
  averageCTR: number;
  averageCPC: number;
  averageCPA: number;
  campaigns: CampaignData[];
  topCampaigns: CampaignData[];
  bottomCampaigns: CampaignData[];
  platformBreakdown: Record<
    string,
    {
      spend: number;
      revenue: number;
      roas: number;
      count: number;
    }
  >;
}

export async function calculateReportMetrics(
  userId: string,
  dateRange: { from: Date; to: Date },
  scope?: { workspaceId?: string; adAccountId?: string }
): Promise<ReportMetrics> {
  if (!scope?.workspaceId) {
    throw new Error("A workspace is required to generate a report.");
  }
  const integrations = await prisma.integration.findMany({
    where: { userId, workspaceId: scope.workspaceId, status: { in: ["OAUTH_GRANTED", "ACCOUNT_SELECTED", "INITIAL_SYNC_RUNNING", "ACTIVE", "SYNC_FAILED"] }, hasAdsAccess: true },
    select: { selectedAdAccountId: true, accountId: true },
  })
  const activeAccountIds = integrations.map((integration) => integration.selectedAdAccountId || integration.accountId).filter(Boolean) as string[]
  if (scope.adAccountId && !activeAccountIds.includes(scope.adAccountId)) {
    throw new Error("The selected ad account is not active in this workspace.")
  }
  const permittedAccountIds = scope.adAccountId ? [scope.adAccountId] : activeAccountIds
  if (!permittedAccountIds.length) {
    throw new Error("No verified selected ad account is available for this report.")
  }

  const campaigns = await prisma.campaign.findMany({
    where: {
      ...verifiedMetricCampaignWhere({ userId, workspaceId: scope?.workspaceId }),
      adAccountId: { in: permittedAccountIds },
      metricsDaily: { some: { metricDate: { gte: dateRange.from, lte: dateRange.to } } },
    },
    include: { metricsDaily: { where: { metricDate: { gte: dateRange.from, lte: dateRange.to } } } },
    orderBy: {
      totalRevenue: 'desc',
    },
  });

  if (!campaigns || campaigns.length === 0) {
    throw new Error("No verified synced campaign data exists in the selected report period.")
  }

  type ReportCampaign = (typeof campaigns)[number]
  const spendFor = (campaign: ReportCampaign) => campaign.metricsDaily.reduce((sum, metric) => sum + Number(metric.spend || 0), 0);
  const revenueFor = (campaign: ReportCampaign) => campaign.metricsDaily.reduce((sum, metric) => sum + Number(metric.revenue || 0), 0);
  const conversionsFor = (campaign: ReportCampaign) => campaign.metricsDaily.reduce((sum, metric) => sum + Number(metric.conversions || 0), 0);
  const clicksFor = (campaign: ReportCampaign) => campaign.metricsDaily.reduce((sum, metric) => sum + Number(metric.clicks || 0), 0);
  const impressionsFor = (campaign: ReportCampaign) => campaign.metricsDaily.reduce((sum, metric) => sum + Number(metric.impressions || 0), 0);
  const roasFor = (campaign: ReportCampaign) => {
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
  const platformBreakdown: Record<
    string,
    {
      spend: number;
      revenue: number;
      roas: number;
      count: number;
    }
  > = {};

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
  const rankedCampaigns = [...campaigns].sort((a, b) => revenueFor(b) - revenueFor(a))
  const topCampaigns = rankedCampaigns.slice(0, 5);
  const bottomCampaigns = rankedCampaigns.slice(-5).reverse();

  const mapCampaign = (c: ReportCampaign): CampaignData => {
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
}
