import { getOpenAI } from "@/lib/openai";
import type { ReportMetrics } from "./report-metrics";
import type { AIReportInsights } from "./report-insights";

export interface WeeklyAction {
  week: number;
  title: string;
  actions: string[];
}

export interface ActionPlan {
  month: string;
  weeks: WeeklyAction[];
  nextSteps: string[];
}

export async function generateActionPlan(
  metrics: ReportMetrics,
  insights: AIReportInsights
): Promise<ActionPlan> {
  console.log("[v0] Generating action plan using OpenAI GPT-4 Turbo");

  const recommendationsText = insights.recommendations
    .map((r, i) => `${i + 1}. ${r.title}: ${r.reasoning}`)
    .join("\n");

  const prompt = `You are an expert marketing strategist. Based on these report insights, create a detailed 4-week action plan with specific daily/weekly tasks.

RECOMMENDATIONS TO IMPLEMENT:
${recommendationsText}

REPORT PERIOD: ${metrics.dateRange.from.toLocaleDateString()} to ${metrics.dateRange.to.toLocaleDateString()}

Return ONLY this JSON object, no markdown, no additional text:
{
  "month": "Month Year (e.g., January 2025)",
  "weeks": [
    {
      "week": 1,
      "title": "Week 1 (Dates) - Theme",
      "actions": [
        "Specific action 1 - be concrete and actionable",
        "Specific action 2",
        "Specific action 3 - maximum 5 actions per week"
      ]
    },
    {
      "week": 2,
      "title": "Week 2 (Dates) - Theme",
      "actions": [
        "Specific action 1",
        "Specific action 2",
        "Specific action 3"
      ]
    },
    {
      "week": 3,
      "title": "Week 3 (Dates) - Theme",
      "actions": [
        "Specific action 1",
        "Specific action 2",
        "Specific action 3"
      ]
    },
    {
      "week": 4,
      "title": "Week 4 (Dates) - Theme",
      "actions": [
        "Specific action 1",
        "Specific action 2",
        "Specific action 3"
      ]
    }
  ],
  "nextSteps": [
    "Next month priority 1",
    "Next month priority 2",
    "Next month priority 3"
  ]
}`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.3,
    });

    console.log("[v0] Action plan response received, parsing JSON");

    // Extract JSON from response
    const responseText = response.choices[0]?.message?.content || "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in action plan response");
    }

    const actionPlan = JSON.parse(jsonMatch[0]) as ActionPlan;

    console.log("[v0] Action plan generated with", actionPlan.weeks.length, "weeks");

    return actionPlan;
  } catch (error) {
    console.error("[v0] Action plan generation error:", error);
    throw error;
  }
}
