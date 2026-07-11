import { getOpenAI } from "@/lib/openai";
import type { ReportMetrics } from "./report-metrics";

export interface ReportRecommendation {
  title: string;
  reasoning: string;
  projectedImpact: string;
  confidence: number;
}

export interface AIReportInsights {
  wins: string[];
  concerns: string[];
  recommendations: ReportRecommendation[];
}

export async function generateAIInsights(metrics: ReportMetrics): Promise<AIReportInsights> {
  console.log("[v0] Generating AI insights using OpenAI GPT-4 Turbo");

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
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 3000,
      temperature: 0.3,
    });

    console.log("[v0] OpenAI response received, parsing JSON");

    // Extract JSON from response
    const responseText = response.choices[0]?.message?.content || "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in OpenAI response");
    }

    const insights = JSON.parse(jsonMatch[0]) as AIReportInsights;

    console.log("[v0] AI insights generated:", {
      wins: insights.wins.length,
      concerns: insights.concerns.length,
      recommendations: insights.recommendations.length,
    });

    return insights;
  } catch (error) {
    console.error("[v0] OpenAI API error:", error);
    throw error;
  }
}
