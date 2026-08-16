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
export function generateActionPlan(metrics, insights) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
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
            const response = yield getOpenAI().chat.completions.create({
                model: UTILITY_MODEL,
                messages: [{ role: "user", content: prompt }],
                max_tokens: 2000,
                temperature: 0.3,
            });
            // Extract JSON from response
            const responseText = ((_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || "";
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error("No JSON found in action plan response");
            }
            const actionPlan = JSON.parse(jsonMatch[0]);
            log("info", "report/action-plan", "AI action plan generated", { weeks: actionPlan.weeks.length });
            return actionPlan;
        }
        catch (error) {
            log("error", "report/action-plan", "AI action plan failed", { message: error instanceof Error ? error.message : "Unknown error" });
            throw error;
        }
    });
}
