const SEARCH_CTR_BENCHMARK = 3.17;
const MIN_SIGNAL_SPEND = 100;
function n(value) {
    const numeric = Number(value !== null && value !== void 0 ? value : 0);
    return Number.isFinite(numeric) ? numeric : 0;
}
function money(value) {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
function pct(value) {
    return `${value.toFixed(2)}%`;
}
function roas(value) {
    return `${value.toFixed(2)}x`;
}
export function calculateAccountAverages(campaigns) {
    const totalSpend = campaigns.reduce((sum, c) => sum + n(c.spend), 0);
    const totalBudget = campaigns.reduce((sum, c) => sum + n(c.budgetAmount), 0);
    const totalImpressions = campaigns.reduce((sum, c) => sum + n(c.impressions), 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + n(c.clicks), 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + n(c.conversions), 0);
    const totalRevenue = campaigns.reduce((sum, c) => sum + n(c.revenue), 0);
    const roasValues = campaigns.map((c) => n(c.roas)).filter((value) => value > 0);
    const cpcValues = campaigns.map((c) => n(c.cpc)).filter((value) => value > 0);
    const ctrValues = campaigns.map((c) => n(c.ctr)).filter((value) => value > 0);
    return {
        campaignCount: campaigns.length,
        activeCampaignCount: campaigns.filter((c) => String(c.status || "").toUpperCase() === "ACTIVE" || String(c.status || "").toUpperCase() === "ENABLED").length,
        totalSpend,
        totalBudget,
        totalImpressions,
        totalClicks,
        totalConversions,
        totalRevenue,
        avgRoas: roasValues.length ? roasValues.reduce((sum, value) => sum + value, 0) / roasValues.length : totalSpend > 0 ? totalRevenue / totalSpend : 0,
        avgCpc: cpcValues.length ? cpcValues.reduce((sum, value) => sum + value, 0) / cpcValues.length : totalClicks > 0 ? totalSpend / totalClicks : 0,
        avgCtr: ctrValues.length ? ctrValues.reduce((sum, value) => sum + value, 0) / ctrValues.length : totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
        avgCpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
        avgConversionRate: totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0,
    };
}
export function analyzeCampaigns(campaigns, averages = calculateAccountAverages(campaigns)) {
    return campaigns.map((campaign) => {
        const spend = n(campaign.spend);
        const budget = n(campaign.budgetAmount);
        const clicks = n(campaign.clicks);
        const conversions = n(campaign.conversions);
        const campaignRoas = n(campaign.roas);
        const campaignCpc = n(campaign.cpc);
        const campaignCtr = n(campaign.ctr);
        const budgetUtilization = budget > 0 ? spend / budget : 0;
        const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
        const roasVsAverage = averages.avgRoas > 0 ? campaignRoas / averages.avgRoas : 0;
        const cpcVsAverage = averages.avgCpc > 0 ? campaignCpc / averages.avgCpc : 0;
        const ctrVsBenchmark = SEARCH_CTR_BENCHMARK > 0 ? campaignCtr / SEARCH_CTR_BENCHMARK : 0;
        const flags = [];
        if (spend > MIN_SIGNAL_SPEND && conversions === 0)
            flags.push("ZERO_CONVERSIONS_WITH_SPEND");
        if (averages.avgRoas > 0 && campaignRoas > 0 && campaignRoas < averages.avgRoas * 0.7)
            flags.push("ROAS_BELOW_ACCOUNT_AVERAGE");
        if (averages.avgRoas > 0 && campaignRoas > averages.avgRoas * 1.35)
            flags.push("ROAS_ABOVE_ACCOUNT_AVERAGE");
        if (averages.avgCpc > 0 && campaignCpc > averages.avgCpc * 1.3)
            flags.push("HIGH_CPC");
        if (campaignCtr > 0 && campaignCtr < SEARCH_CTR_BENCHMARK * 0.7)
            flags.push("CTR_BELOW_BENCHMARK");
        if (budget > 0 && budgetUtilization > 0.9 && campaignRoas >= averages.avgRoas)
            flags.push("BUDGET_LIMITED_WINNER");
        if (!campaign.hasCreative)
            flags.push("NO_CREATIVE_ATTACHED");
        const wasteScore = (campaignRoas > 0 && averages.avgRoas > 0 ? Math.max(0, 1 - campaignRoas / averages.avgRoas) * 45 : 0) +
            (conversions === 0 && spend > MIN_SIGNAL_SPEND ? 35 : 0) +
            (averages.avgCpc > 0 ? Math.max(0, campaignCpc / averages.avgCpc - 1) * 20 : 0);
        const scaleScore = (averages.avgRoas > 0 ? Math.max(0, 1 - campaignRoas / averages.avgRoas - 1) * 45 : 0) +
            (budget > 0 && budgetUtilization > 0.75 ? 25 : 0) +
            (conversionRate > averages.avgConversionRate ? 20 : 0);
        const creativeRiskScore = (!campaign.hasCreative ? 40 : 0) +
            (campaignCtr > 0 ? Math.max(0, 1 - campaignCtr / SEARCH_CTR_BENCHMARK) * 35 : 20) +
            (clicks > 250 && conversions === 0 ? 25 : 0);
        return Object.assign(Object.assign({}, campaign), { budgetUtilization,
            conversionRate,
            roasVsAverage,
            cpcVsAverage,
            ctrVsBenchmark, wasteScore: Math.round(wasteScore), scaleScore: Math.round(scaleScore), creativeRiskScore: Math.round(creativeRiskScore), flags });
    });
}
export function buildRuleRecommendations(campaigns, averages = calculateAccountAverages(campaigns)) {
    const analyzed = analyzeCampaigns(campaigns, averages);
    const recommendations = [];
    for (const campaign of analyzed) {
        const spend = n(campaign.spend);
        const budget = n(campaign.budgetAmount);
        const campaignRoas = n(campaign.roas);
        let campaignCpc = 0;
        if (campaign.cpc) {
            campaignCpc = n(campaign.cpc);
        }
        let campaignCtr = 0;
        if (campaign.ctr) {
            campaignCtr = n(campaign.ctr);
        }
        if (campaign.flags.includes("ZERO_CONVERSIONS_WITH_SPEND") || campaign.wasteScore >= 55) {
            recommendations.push({
                id: `pause_${campaign.id}`,
                priority: "HIGH",
                type: campaign.flags.includes("ZERO_CONVERSIONS_WITH_SPEND") ? "PAUSE" : "BUDGET_DECREASE",
                campaignId: campaign.id,
                campaignName: campaign.name,
                externalId: campaign.externalId,
                title: campaign.flags.includes("ZERO_CONVERSIONS_WITH_SPEND") ? "Stop wasted spend" : "Reduce inefficient budget",
                reasoning: `${campaign.name} spent ${money(spend)} with ${roas(campaignRoas)} ROAS versus the account average ${roas(averages.avgRoas)}. CPC is ${money(campaignCpc)} versus account average ${money(averages.avgCpc)}.`,
                currentValue: campaign.flags.includes("ZERO_CONVERSIONS_WITH_SPEND") ? `${n(campaign.conversions)} conversions` : `${money(budget)} budget`,
                recommendedValue: campaign.flags.includes("ZERO_CONVERSIONS_WITH_SPEND") ? "Pause campaign" : `${money(Math.max(1, budget * 0.75))} budget`,
                expectedImpact: "Protect budget and improve blended ROAS by removing low-efficiency spend.",
                potentialRevenueImpact: Math.round(spend * 0.2),
                confidence: campaign.flags.includes("ZERO_CONVERSIONS_WITH_SPEND") ? 90 : 82,
            });
            continue;
        }
        if (campaign.scaleScore >= 55 || campaign.flags.includes("BUDGET_LIMITED_WINNER")) {
            recommendations.push({
                id: `scale_${campaign.id}`,
                priority: campaignRoas >= averages.avgRoas * 1.5 ? "HIGH" : "MEDIUM",
                type: "BUDGET_INCREASE",
                campaignId: campaign.id,
                campaignName: campaign.name,
                externalId: campaign.externalId,
                title: "Scale proven winner",
                reasoning: `${campaign.name} is outperforming with ${roas(campaignRoas)} ROAS against account average ${roas(averages.avgRoas)} and ${pct(campaign.conversionRate)} conversion rate.`,
                currentValue: `${money(budget)} budget`,
                recommendedValue: `${money(Math.max(1, budget * 1.2))} budget`,
                expectedImpact: "Capture more conversions while staying within a proven efficiency band.",
                potentialRevenueImpact: Math.round(spend * Math.max(0.1, Math.min(0.35, campaign.roasVsAverage - 1)) * Math.max(campaignRoas, 1)),
                confidence: campaignRoas >= averages.avgRoas * 1.5 ? 88 : 76,
            });
        }
        if (campaign.creativeRiskScore >= 45) {
            recommendations.push({
                id: `creative_${campaign.id}`,
                priority: campaign.creativeRiskScore >= 65 ? "HIGH" : "MEDIUM",
                type: "CREATIVE_REFRESH",
                campaignId: campaign.id,
                campaignName: campaign.name,
                externalId: campaign.externalId,
                title: "Refresh ad creative",
                reasoning: `${campaign.name} has ${pct(campaignCtr)} CTR versus the ${pct(SEARCH_CTR_BENCHMARK)} search benchmark${campaign.hasCreative ? "" : " and no saved creative in GROWZZY OS"}.`,
                currentValue: `${pct(campaignCtr)} CTR`,
                recommendedValue: "Generate new ad angles",
                expectedImpact: "Improve click quality and reduce CPC with fresher, more relevant creative.",
                potentialRevenueImpact: Math.round(spend * 0.12),
                confidence: 74,
            });
        }
    }
    return recommendations
        .sort((a, b) => {
        const priority = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return priority[b.priority] - priority[a.priority] || b.confidence - a.confidence;
    })
        .slice(0, 8);
}
// FIXED: Made creative score threshold dynamic based on historical performance
export function scoreCreativeVariation(input, historicalAvgScore) {
    var _a;
    const headline = String(input.headline || "");
    const body = String(input.body || "");
    const description = String(input.description || "");
    const cta = String(input.cta || "");
    const all = `${headline} ${body} ${description}`.toLowerCase();
    const valueTokens = String(input.valueProp || "").toLowerCase().split(/\W+/).filter((token) => token.length > 3);
    const painTokens = String(input.painPoint || "").toLowerCase().split(/\W+/).filter((token) => token.length > 3);
    const clarity = Math.min(25, 8 + (headline.length > 8 ? 7 : 0) + (body.length > 35 ? 6 : 0) + (cta.length > 2 ? 4 : 0));
    const relevance = Math.min(25, 8 +
        Math.min(8, painTokens.filter((token) => all.includes(token)).length * 3) +
        Math.min(7, valueTokens.filter((token) => all.includes(token)).length * 2) +
        (input.targetPersona && all.includes((_a = String(input.targetPersona).split(" ")[0]) === null || _a === void 0 ? void 0 : _a.toLowerCase()) ? 2 : 0));
    const differentiation = Math.min(25, 10 +
        (/\d/.test(all) ? 5 : 0) +
        (input.socialProof && all.includes(String(input.socialProof).toLowerCase().split(" ")[0] || "") ? 5 : 0) +
        (/[?!]/.test(headline) ? 3 : 0) +
        (headline.length <= 40 ? 2 : 0));
    const ctaStrength = Math.min(25, 8 + (/(start|book|get|try|shop|claim|download|audit|demo)/i.test(cta) ? 9 : 0) + (cta.length <= 28 ? 4 : 0) + (/(free|now|today|no card|demo)/i.test(`${cta} ${body}`) ? 4 : 0));
    const total = clarity + relevance + differentiation + ctaStrength;
    // FIXED: Dynamic threshold based on historical average score
    // If no historical data provided, fall back to a reasonable default (65)
    // Otherwise, set threshold at 80% of historical average to encourage improvement
    const needsRevisionThreshold = historicalAvgScore
        ? Math.max(40, Math.min(80, Math.floor(historicalAvgScore * 0.8))) // Between 40-80, 80% of avg
        : 65; // Fallback to original threshold
    return {
        score: total,
        status: total < needsRevisionThreshold ? "Needs revision" : total >= 85 ? "Strong" : "Good",
        breakdown: { clarity, relevance, differentiation, ctaStrength },
    };
}
export function calculateAuditScores(campaigns, averages = calculateAccountAverages(campaigns)) {
    const analyzed = analyzeCampaigns(campaigns, averages);
    const waste = analyzed.reduce((sum, campaign) => sum + campaign.wasteScore, 0) / Math.max(1, analyzed.length);
    const creativeRisk = analyzed.reduce((sum, campaign) => sum + campaign.creativeRiskScore, 0) / Math.max(1, analyzed.length);
    const budgetEfficiency = Math.max(0, Math.min(100, 100 - waste));
    const creativeHealth = Math.max(0, Math.min(100, 100 - creativeRisk));
    const biddingStrategy = Math.max(0, Math.min(100, averages.avgCpa > 0 || averages.avgRoas > 0 ? 75 : 55));
    const campaignStructure = Math.max(0, Math.min(100, campaigns.length ? 70 : 0));
    const overallScore = Math.round((budgetEfficiency + creativeHealth + biddingStrategy + campaignStructure) / 4);
    return {
        overallScore,
        scores: {
            budgetEfficiency: Math.round(budgetEfficiency),
            creativeHealth: Math.round(creativeHealth),
            biddingStrategy: Math.round(biddingStrategy),
            campaignStructure: Math.round(campaignStructure),
        },
    };
}
export function scoreLeadFit(lead) {
    let score = 35;
    if (lead.email)
        score += 15;
    if (lead.phone)
        score += 15;
    if (lead.company)
        score += 10;
    if (Number(lead.value || 0) > 0)
        score += 15;
    if (/book|demo|quote|pricing|consult/i.test(`${lead.notes || ""} ${lead.source || ""}`))
        score += 10;
    if (/lost|spam|invalid/i.test(String(lead.status || "")))
        score -= 25;
    score = Math.max(0, Math.min(100, Math.round(score)));
    return {
        score,
        reasoning: `Lead fit ${score}/100 based on contact completeness, company/value signals, and intent notes.`,
    };
}
