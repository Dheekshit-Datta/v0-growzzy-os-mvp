var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { getOpenAI } from "@/lib/openai";
import { UTILITY_MODEL } from "@/lib/ai-utility";
import { log } from "@/lib/logger";
export function generateAIInsights(metrics) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const topCampaignsText = metrics.topCampaigns
            .slice(0, 10)
            .map((c, i) => `${i + 1}. ${c.name}: ROAS ${c.roas.toFixed(2)}x, Spend $${c.spend.toFixed(2)}`)
            .join("\n");
        const bottomCampaignsText = metrics.bottomCampaigns
            .slice(0, 5)
            .map((c, i) => `${i + 1}. ${c.name}: ROAS ${c.roas.toFixed(2)}x, Spend $${c.spend.toFixed(2)}`)
            .join("\n");
        const platformBreakdownText = Object.entries(metrics.platformBreakdown)
            .map(([platform, data]) => `${platform}: $${data.spend.toFixed(2)} spend, $${data.revenue.toFixed(2)} revenue, ${data.roas.toFixed(2)}x ROAS`)
            .join("\n");
        const prompt = `You are an expert marketing performance analyst. Analyze this marketing data and provide EXACTLY the following JSON response format with no additional text:

OVERALL METRICS:
- Date Range: ${metrics.dateRange.from.toLocaleDateString()} to ${metrics.dateRange.to.toLocaleDateString()}
- Total Spend: $${metrics.totalSpend.toFixed(2)}
- Total Revenue: $${metrics.totalRevenue.toFixed(2)}
- ROAS: ${metrics.averageROAS.toFixed(2)}x
- Conversions: ${metrics.totalConversions}
- CTR: ${metrics.averageCTR.toFixed(2)}%
- CPC: $${metrics.averageCPC.toFixed(2)}
- CPA: $${metrics.averageCPA.toFixed(2)}

TOP CAMPAIGNS (by revenue):
${topCampaignsText}

BOTTOM CAMPAIGNS (by ROAS):
${bottomCampaignsText}

PLATFORM BREAKDOWN:
${platformBreakdownText}

Return ONLY this JSON object, no markdown, no additional text:
{
  "wins": [
    "Specific achievement with exact numbers - make 3 concrete wins",
    "Second specific achievement with exact numbers",
    "Third specific achievement with exact numbers"
  ],
  "concerns": [
    "Specific issue with impact analysis - make 3 concrete concerns",
    "Second specific issue with impact analysis",
    "Third specific issue with impact analysis"
  ],
  "recommendations": [
    {
      "title": "Specific action to take",
      "reasoning": "Why this matters based on the data",
      "projectedImpact": "Expected outcome with specific numbers or percentages",
      "confidence": 0.87
    },
    {
      "title": "Second specific action",
      "reasoning": "Why this matters",
      "projectedImpact": "Expected outcome",
      "confidence": 0.82
    },
    {
      "title": "Third specific action",
      "reasoning": "Why this matters",
      "projectedImpact": "Expected outcome",
      "confidence": 0.75
    },
    {
      "title": "Fourth specific action",
      "reasoning": "Why this matters",
      "projectedImpact": "Expected outcome",
      "confidence": 0.70
    },
    {
      "title": "Fifth specific action",
      "reasoning": "Why this matters",
      "projectedImpact": "Expected outcome",
      "confidence": 0.65
    }
  ]
}`;
        try {
            const response = yield getOpenAI().chat.completions.create({
                model: UTILITY_MODEL,
                messages: [{ role: "user", content: prompt }],
                max_tokens: 3000,
                temperature: 0.3,
            });
            // Extract JSON from response
            const responseText = ((_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || "";
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error("No JSON found in OpenAI response");
            }
            const insights = JSON.parse(jsonMatch[0]);
            log("info", "report/insights", "AI insights generated", {
                wins: insights.wins.length,
                concerns: insights.concerns.length,
                recommendations: insights.recommendations.length,
            });
            return insights;
        }
        catch (error) {
            log("error", "report/insights", "AI insights failed", { message: error instanceof Error ? error.message : "Unknown error" });
            throw error;
        }
    });
}
