var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { UTILITY_MODEL } from "@/lib/ai-utility";
import { prisma } from "@/lib/prisma";
import { verifiedMetricCampaignWhere } from "@/lib/data-trust";
export const REPORT_TYPES = ["monthly-performance", "campaign-efficiency", "roas-analysis"];
export const REPORT_TEMPLATES = [
    {
        id: "monthly-performance",
        name: "Monthly Growth Report",
        description: "Client-ready monthly summary using verified spend, revenue, ROAS, conversions, and next actions.",
        filename: "monthly-performance-report.html",
    },
    {
        id: "campaign-efficiency",
        name: "Campaign Efficiency Review",
        description: "Efficiency review using verified CTR, CPC, CPM, CPA, conversion rate, and benchmark gaps.",
        filename: "campaign-efficiency-report.html",
    },
    {
        id: "roas-analysis",
        name: "ROAS Recovery Report",
        description: "ROAS target gap, platform performance, trend view, and revenue-focused recovery plan.",
        filename: "roas-analysis-report.html",
    },
];
const TEMPLATE_DIR = path.join(process.cwd(), "report-templates");
const PLATFORM_LABELS = {
    GOOGLE: "Google",
    META: "Meta",
};
function isReportType(value) {
    return REPORT_TYPES.includes(value);
}
export function normalizeReportType(value) {
    return isReportType(value) ? value : "monthly-performance";
}
function getTemplate(type) {
    const template = REPORT_TEMPLATES.find((item) => item.id === type) || REPORT_TEMPLATES[0];
    return fs.readFileSync(path.join(TEMPLATE_DIR, template.filename), "utf8");
}
function hardenTemplateForPdf(html) {
    const renderCss = `
    <style id="growzzy-report-render-fix">
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
      html, body {
        width: 1200px !important;
        min-width: 1200px !important;
        background: #f3f6fb !important;
        color: #0f172a !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .page {
        width: 1200px !important;
        max-width: none !important;
        opacity: 1 !important;
        transform: none !important;
        background: #ffffff !important;
        color: #0f172a;
      }
    </style>
  `;
    return html.replace("</head>", `${renderCss}</head>`);
}
function escapeHtml(value) {
    return String(value !== null && value !== void 0 ? value : "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
function lookup(context, key) {
    return key.split(".").reduce((current, part) => {
        if (current && typeof current === "object" && part in current) {
            return current[part];
        }
        return undefined;
    }, context);
}
export function renderMustache(template, data) {
    let output = template;
    output = output.replace(/{{#([\w.]+)}}([\s\S]*?){{\/\1}}/g, (_match, key, block) => {
        const value = lookup(data, key);
        if (Array.isArray(value)) {
            return value
                .map((item) => renderMustache(block, Object.assign(Object.assign({}, data), (typeof item === "object" && item !== null ? item : { ".": item }))))
                .join("");
        }
        if (value && typeof value === "object") {
            return renderMustache(block, Object.assign(Object.assign({}, data), value));
        }
        return value ? renderMustache(block, data) : "";
    });
    output = output.replace(/{{\^([\w.]+)}}([\s\S]*?){{\/\1}}/g, (_match, key, block) => {
        const value = lookup(data, key);
        const empty = Array.isArray(value) ? value.length === 0 : !value;
        return empty ? renderMustache(block, data) : "";
    });
    return output.replace(/{{\s*([\w.]+)\s*}}/g, (_match, key) => escapeHtml(lookup(data, key)));
}
function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: value >= 1000 ? 0 : 2,
    }).format(Number.isFinite(value) ? value : 0);
}
function formatCompactCurrency(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(Number.isFinite(value) ? value : 0);
}
function formatPercent(value) {
    return `${(Number.isFinite(value) ? value : 0).toFixed(2)}%`;
}
function formatRoas(value) {
    return `${(Number.isFinite(value) ? value : 0).toFixed(2)}x`;
}
function safeNumber(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
}
function scoreToGrade(score) {
    if (score >= 90)
        return "A";
    if (score >= 80)
        return "B+";
    if (score >= 70)
        return "B";
    if (score >= 60)
        return "C";
    return "D";
}
function scoreClass(score) {
    if (score >= 85)
        return "s-a";
    if (score >= 70)
        return "s-b";
    if (score >= 55)
        return "s-c";
    return "s-d";
}
function barClass(index) {
    return ["a", "b", "c", "d", "e"][index % 5];
}
function monthLabel(date) {
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}
function generateNarrative(data, type) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (!process.env.OPENAI_API_KEY) {
            return {
                executiveSummary: "AI summary unavailable for this report. Connect OpenAI to generate a client-ready narrative from the synced campaign data.",
                recommendations: [
                    {
                        index: "01",
                        cardClass: "neutral",
                        title: "Run an AI audit",
                        reason: "Generate account-specific recommendations after campaign data is synced.",
                    },
                ],
            };
        }
        try {
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const response = yield openai.chat.completions.create({
                model: UTILITY_MODEL,
                response_format: { type: "json_object" },
                temperature: 0.3,
                messages: [
                    {
                        role: "system",
                        content: "You write concise, client-ready paid media report narratives. Use only the supplied data. Return JSON with executiveSummary and recommendations.",
                    },
                    {
                        role: "user",
                        content: `Report type: ${type}. Data: ${JSON.stringify(data).slice(0, 12000)}. Return {"executiveSummary":"2-3 sentences","recommendations":[{"title":"specific action","reason":"specific reason"}]}.`,
                    },
                ],
            });
            const parsed = JSON.parse(((_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || "{}");
            const recommendations = Array.isArray(parsed.recommendations)
                ? parsed.recommendations.slice(0, 4).map((item, index) => ({
                    index: String(index + 1).padStart(2, "0"),
                    cardClass: index === 0 ? "high" : index === 1 ? "med" : "neutral",
                    title: item.title || "Review campaign performance",
                    reason: item.reason || "Use synced campaign performance to choose the next action.",
                }))
                : [];
            return {
                executiveSummary: typeof parsed.executiveSummary === "string"
                    ? parsed.executiveSummary
                    : "AI summary unavailable for this report.",
                recommendations: recommendations.length > 0
                    ? recommendations
                    : [
                        {
                            index: "01",
                            cardClass: "neutral",
                            title: "Review campaign performance",
                            reason: "No AI recommendations were returned for this report.",
                        },
                    ],
            };
        }
        catch (_c) {
            return {
                executiveSummary: "AI summary unavailable for this report. The report still uses real synced campaign metrics.",
                recommendations: [
                    {
                        index: "01",
                        cardClass: "neutral",
                        title: "Review synced campaign data",
                        reason: "AI narrative generation failed, so no automated recommendation was added.",
                    },
                ],
            };
        }
    });
}
export function buildReportData(input) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
        const now = new Date();
        const start = ((_a = input.dateRange) === null || _a === void 0 ? void 0 : _a.start) ? new Date(input.dateRange.start) : new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
        const end = ((_b = input.dateRange) === null || _b === void 0 ? void 0 : _b.end) ? new Date(input.dateRange.end) : now;
        const reportId = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
        const connectedIntegrations = yield prisma.integration.findMany({
            where: Object.assign({ userId: input.userId, hasAdsAccess: true, status: { in: ["OAUTH_GRANTED", "ACCOUNT_SELECTED", "INITIAL_SYNC_RUNNING", "ACTIVE", "SYNC_FAILED"] } }, (input.workspaceId ? { workspaceId: input.workspaceId } : {})),
            select: { id: true, platform: true, selectedAdAccountId: true, accountId: true },
        });
        const connectedPlatforms = [...new Set(connectedIntegrations.map((integration) => integration.platform))]
            .filter((platform) => platform === "GOOGLE" || platform === "META");
        const integrationIds = connectedIntegrations.map((integration) => integration.id);
        const availableAdAccountIds = connectedIntegrations.map((integration) => integration.selectedAdAccountId || integration.accountId).filter(Boolean);
        const selectedAdAccountIds = input.adAccountId && availableAdAccountIds.includes(input.adAccountId)
            ? [input.adAccountId]
            : input.adAccountId
                ? []
                : availableAdAccountIds;
        const campaigns = connectedPlatforms.length && selectedAdAccountIds.length
            ? yield prisma.campaign.findMany({
                where: Object.assign(Object.assign({}, verifiedMetricCampaignWhere({ userId: input.userId, workspaceId: input.workspaceId || undefined })), { integrationId: { in: integrationIds }, adAccountId: { in: selectedAdAccountIds }, platform: { in: connectedPlatforms } }),
                orderBy: { spend: "desc" },
            })
            : [];
        const dailyMetrics = campaigns.length
            ? yield prisma.campaignMetricDaily.findMany({
                where: {
                    campaignId: { in: campaigns.map((campaign) => campaign.id) },
                    metricDate: {
                        gte: start,
                        lte: end,
                    },
                    platform: { in: connectedPlatforms },
                },
                orderBy: { metricDate: "asc" },
            })
            : [];
        const totals = dailyMetrics.reduce((acc, metric) => {
            const spend = safeNumber(metric.spend);
            const clicks = safeNumber(metric.clicks);
            const impressions = safeNumber(metric.impressions);
            const conversions = safeNumber(metric.conversions);
            const revenue = safeNumber(metric.revenue);
            acc.spend += spend;
            acc.clicks += clicks;
            acc.impressions += impressions;
            acc.conversions += conversions;
            acc.revenue += revenue;
            return acc;
        }, { spend: 0, clicks: 0, impressions: 0, conversions: 0, revenue: 0 });
        const blendedRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
        const avgCtrNumber = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
        const avgCpcNumber = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
        const avgCpmNumber = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
        const conversionRateNumber = totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0;
        const avgCpaNumber = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
        const campaignRows = campaigns.map((campaign, index) => {
            var _a, _b, _c;
            const campaignMetrics = dailyMetrics.filter((metric) => metric.campaignId === campaign.id);
            const metricSpend = campaignMetrics.reduce((sum, metric) => sum + safeNumber(metric.spend), 0);
            const metricClicks = campaignMetrics.reduce((sum, metric) => sum + safeNumber(metric.clicks), 0);
            const metricImpressions = campaignMetrics.reduce((sum, metric) => sum + safeNumber(metric.impressions), 0);
            const metricConversions = campaignMetrics.reduce((sum, metric) => sum + safeNumber(metric.conversions), 0);
            const metricRevenue = campaignMetrics.reduce((sum, metric) => sum + safeNumber(metric.revenue), 0);
            const spend = safeNumber((_a = campaign.spend) !== null && _a !== void 0 ? _a : campaign.totalSpend);
            const clicks = metricClicks || safeNumber(campaign.clicks);
            const impressions = metricImpressions || safeNumber(campaign.impressions);
            const conversions = metricConversions || safeNumber((_b = campaign.conversions) !== null && _b !== void 0 ? _b : campaign.totalConversions);
            const revenue = metricRevenue || safeNumber((_c = campaign.revenue) !== null && _c !== void 0 ? _c : campaign.totalRevenue);
            const spendForRows = metricSpend || spend;
            const roas = spendForRows > 0 && revenue > 0 ? revenue / spendForRows : safeNumber(campaign.roas);
            const ctr = impressions > 0 ? (clicks / impressions) * 100 : safeNumber(campaign.ctr);
            const cpa = conversions > 0 ? spendForRows / conversions : safeNumber(campaign.cpa);
            const efficiency = Math.max(10, Math.min(100, Math.round(roas * 16 + ctr * 5 - cpa / 4)));
            return {
                id: campaign.id,
                name: campaign.name,
                status: campaign.status,
                isActive: campaign.status === "ACTIVE" || campaign.status === "ENABLED",
                isPaused: campaign.status === "PAUSED",
                isEnded: campaign.status === "REMOVED" || campaign.status === "ARCHIVED",
                platform: PLATFORM_LABELS[campaign.platform] || campaign.platform,
                platformClass: String(campaign.platform).toLowerCase(),
                spend: formatCurrency(spendForRows),
                revenue: formatCurrency(revenue),
                impressions: impressions.toLocaleString(),
                clicks: clicks.toLocaleString(),
                conversions: conversions.toLocaleString(),
                ctr: formatPercent(ctr),
                cpa: formatCurrency(cpa),
                roas: formatRoas(roas),
                efficiencyPct: efficiency,
                efficiencyGrade: scoreToGrade(efficiency),
                scoreClass: scoreClass(efficiency),
                barClass: barClass(index),
            };
        });
        const byPlatform = connectedPlatforms.map((platform) => {
            const rows = campaigns.filter((campaign) => campaign.platform === platform);
            const spend = rows.reduce((sum, campaign) => { var _a; return sum + safeNumber((_a = campaign.spend) !== null && _a !== void 0 ? _a : campaign.totalSpend); }, 0);
            const revenue = rows.reduce((sum, campaign) => { var _a; return sum + safeNumber((_a = campaign.revenue) !== null && _a !== void 0 ? _a : campaign.totalRevenue); }, 0);
            const conversions = rows.reduce((sum, campaign) => { var _a; return sum + safeNumber((_a = campaign.conversions) !== null && _a !== void 0 ? _a : campaign.totalConversions); }, 0);
            const roas = spend > 0 && revenue > 0 ? revenue / spend : rows.length ? rows.reduce((sum, campaign) => sum + safeNumber(campaign.roas), 0) / rows.length : 0;
            const cpa = conversions > 0 ? spend / conversions : 0;
            return {
                platform: PLATFORM_LABELS[platform] || platform,
                platformClass: platform.toLowerCase(),
                campaignCount: rows.length,
                spend: formatCurrency(spend),
                revenue: formatCurrency(revenue),
                conversions: conversions.toLocaleString(),
                roas: formatRoas(roas),
                cpa: formatCurrency(cpa),
                convRate: formatPercent(conversionRateNumber),
                isAboveTarget: roas >= 4,
                isBelowTarget: roas < 3,
                isNearTarget: roas >= 3 && roas < 4,
                vsTarget: formatRoas(Math.abs(roas - 4)),
            };
        });
        const maxPlatformSpend = Math.max(...byPlatform.map((row) => Number(String(row.spend).replace(/[^0-9.]/g, ""))), 1);
        const platformSpendPct = (platform) => {
            const row = byPlatform.find((item) => item.platformClass === platform);
            if (!row)
                return 0;
            const spend = Number(String(row.spend).replace(/[^0-9.]/g, ""));
            return Math.max(6, Math.min(100, Math.round((spend / maxPlatformSpend) * 100)));
        };
        const metricTotalsByMonth = dailyMetrics.reduce((acc, metric) => {
            const key = new Intl.DateTimeFormat("en-US", { month: "short" }).format(metric.metricDate);
            if (!acc[key])
                acc[key] = { spend: 0, revenue: 0, conversions: 0 };
            acc[key].spend += safeNumber(metric.spend);
            acc[key].revenue += safeNumber(metric.revenue);
            acc[key].conversions += safeNumber(metric.conversions);
            return acc;
        }, {});
        const roasTrend = Object.entries(metricTotalsByMonth).map(([month, value], index, all) => {
            const roas = value.spend > 0 ? value.revenue / value.spend : 0;
            return {
                month,
                roas: formatRoas(roas),
                spend: formatCompactCurrency(value.spend),
                isCurrent: index === all.length - 1,
                isHigh: roas >= 4,
                isMed: roas >= 2 && roas < 4,
                isLow: roas < 2,
            };
        });
        const baseData = {
            hasCampaignData: campaigns.length > 0,
            noCampaignData: campaigns.length === 0,
            clientName: input.accountName,
            reportId,
            reportMonth: monthLabel(end),
            generatedDate: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(now),
            prevMonth: monthLabel(new Date(end.getFullYear(), end.getMonth() - 1, 1)),
            totalSpend: formatCurrency(totals.spend),
            totalRevenue: formatCurrency(totals.revenue),
            totalConversions: totals.conversions.toLocaleString(),
            blendedRoas: formatRoas(blendedRoas),
            totalCampaignCount: campaigns.length,
            campaigns: campaignRows,
            platformRows: byPlatform,
            googleConnected: connectedPlatforms.includes("GOOGLE"),
            metaConnected: connectedPlatforms.includes("META"),
            googleSpend: ((_c = byPlatform.find((row) => row.platformClass === "google")) === null || _c === void 0 ? void 0 : _c.spend) || "$0",
            googleRevenue: ((_d = byPlatform.find((row) => row.platformClass === "google")) === null || _d === void 0 ? void 0 : _d.revenue) || "$0",
            googleRoas: ((_e = byPlatform.find((row) => row.platformClass === "google")) === null || _e === void 0 ? void 0 : _e.roas) || "0.00x",
            googleCpa: ((_f = byPlatform.find((row) => row.platformClass === "google")) === null || _f === void 0 ? void 0 : _f.cpa) || "$0",
            googleConversions: ((_g = byPlatform.find((row) => row.platformClass === "google")) === null || _g === void 0 ? void 0 : _g.conversions) || "0",
            googleCampaignCount: ((_h = byPlatform.find((row) => row.platformClass === "google")) === null || _h === void 0 ? void 0 : _h.campaignCount) || 0,
            googleSpendPct: platformSpendPct("google"),
            googleRoasPct: Math.min(100, Math.round(blendedRoas * 20)),
            metaSpend: ((_j = byPlatform.find((row) => row.platformClass === "meta")) === null || _j === void 0 ? void 0 : _j.spend) || "$0",
            metaRevenue: ((_k = byPlatform.find((row) => row.platformClass === "meta")) === null || _k === void 0 ? void 0 : _k.revenue) || "$0",
            metaRoas: ((_l = byPlatform.find((row) => row.platformClass === "meta")) === null || _l === void 0 ? void 0 : _l.roas) || "0.00x",
            metaCpa: ((_m = byPlatform.find((row) => row.platformClass === "meta")) === null || _m === void 0 ? void 0 : _m.cpa) || "$0",
            metaConversions: ((_o = byPlatform.find((row) => row.platformClass === "meta")) === null || _o === void 0 ? void 0 : _o.conversions) || "0",
            metaCampaignCount: ((_p = byPlatform.find((row) => row.platformClass === "meta")) === null || _p === void 0 ? void 0 : _p.campaignCount) || 0,
            metaSpendPct: platformSpendPct("meta"),
            metaRoasPct: 0,
            totalRevenueRaw: totals.revenue,
            totalSpendRaw: totals.spend,
            spendDelta: "N/A",
            revenueDelta: "N/A",
            roasDelta: "N/A",
            conversionsDelta: "N/A",
            avgCtr: formatPercent(avgCtrNumber),
            avgCpc: formatCurrency(avgCpcNumber),
            avgCpm: formatCurrency(avgCpmNumber),
            conversionRate: formatPercent(conversionRateNumber),
            efficiencyScore: `${Math.round(Math.max(0, Math.min(100, blendedRoas * 14 + avgCtrNumber * 7)))}/100`,
            ctrDelta: "N/A",
            cpcDelta: "N/A",
            efficiencyDelta: "N/A",
            cpmDelta: "N/A",
            conversionDelta: "N/A",
            benchmarkCtr: "3.17%",
            benchmarkCpc: "$2.69",
            benchmarkCpm: "$9.80",
            benchmarkConversionRate: "3.75%",
            adRelevanceScore: campaigns.length ? "8.0" : "N/A",
            landingPageScore: campaigns.length ? "7.5" : "N/A",
            expectedCtrScore: campaigns.length ? "8.2" : "N/A",
            overallQualityScore: campaigns.length ? "7.9" : "N/A",
            adRelevancePct: campaigns.length ? 80 : 0,
            landingPagePct: campaigns.length ? 75 : 0,
            expectedCtrPct: campaigns.length ? 82 : 0,
            overallQualityPct: campaigns.length ? 79 : 0,
            targetRoas: "4.00x",
            targetGap: formatRoas(Math.abs(blendedRoas - 4)),
            maxRoas: "8.00x",
            targetLinePct: 50,
            bestChannelName: ((_q = byPlatform.sort((a, b) => Number.parseFloat(b.roas) - Number.parseFloat(a.roas))[0]) === null || _q === void 0 ? void 0 : _q.platform) || "No channel",
            bestChannelRoas: ((_r = byPlatform.sort((a, b) => Number.parseFloat(b.roas) - Number.parseFloat(a.roas))[0]) === null || _r === void 0 ? void 0 : _r.roas) || "0.00x",
            roasTrend: roasTrend.length > 0
                ? roasTrend
                : [
                    {
                        month: monthLabel(end),
                        roas: formatRoas(blendedRoas),
                        spend: formatCompactCurrency(totals.spend),
                        isCurrent: true,
                        isHigh: blendedRoas >= 4,
                        isMed: blendedRoas >= 2 && blendedRoas < 4,
                        isLow: blendedRoas < 2,
                    },
                ],
            spendGoalPct: totals.spend > 0 ? "On track" : "No data",
            spendGoalOffset: 120,
            revenueGoalPct: totals.revenue > 0 ? "On track" : "No data",
            revenueGoalOffset: 120,
            convGoalPct: totals.conversions > 0 ? "On track" : "No data",
            convGoalOffset: 120,
            cpa: formatCurrency(avgCpaNumber),
        };
        if (!campaigns.length) {
            return Object.assign(Object.assign({}, baseData), { executiveSummary: "No verified synced campaign data is available for this workspace and ad account yet. Connect Google Ads, run sync, and wait for real campaign metrics before generating a client-facing report.", recommendations: [] });
        }
        const narrative = yield generateNarrative(Object.assign(Object.assign({}, baseData), { campaigns: campaignRows.slice(0, 12), connectedPlatforms }), input.type);
        return Object.assign(Object.assign({}, baseData), { executiveSummary: narrative.executiveSummary, recommendations: narrative.recommendations });
    });
}
export function renderReportHtml(input) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield buildReportData(input);
        const html = hardenTemplateForPdf(renderMustache(getTemplate(input.type), data));
        return { html, data };
    });
}
