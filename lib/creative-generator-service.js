var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import OpenAI from "openai";
import { log } from "@/lib/logger";
let _openai = null;
const openai = new Proxy({}, {
    get: (_t, prop) => {
        if (!_openai)
            _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        return _openai[prop];
    },
});
export function generateAdCreatives(productData) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            const benefitsList = productData.benefits.join(", ");
            const prompt = `You are an expert direct-response copywriter. Create 10 high-converting ad variations for:

Product: ${productData.name}
Description: ${productData.description}
Key Benefits: ${benefitsList}
Target Audience: ${productData.targetAudience}
Campaign Goal: ${productData.goal}
Platform: ${productData.platform}

For each variation provide JSON with:
- primaryText (max 125 chars, punchy hook)
- headline (max 40 chars)
- description (max 30 chars)
- cta (call-to-action text)
- creativeIdea (what image/video should show)
- psychologicalTrigger (urgency, social proof, curiosity, scarcity, FOMO, exclusivity, etc.)
- score (1-10 predicted performance score)

Use different copywriting frameworks:
- PAS (Problem-Agitate-Solution)
- AIDA (Attention-Interest-Desire-Action)
- Before-After-Bridge
- Problem-Promise-Proof-Push

Return in this JSON format:
{
  "creatives": [
    {
      "primaryText": "...",
      "headline": "...",
      "description": "...",
      "cta": "...",
      "creativeIdea": "...",
      "psychologicalTrigger": "...",
      "score": 9
    }
  ]
}

Make each DIFFERENT, not just word swaps.`;
            const response = yield openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert direct-response copywriter. Respond ONLY with the requested JSON."
                    },
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
                response_format: { type: "json_object" },
                temperature: 0.8,
            });
            const content = (_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content;
            if (content) {
                try {
                    const parsed = JSON.parse(content);
                    return parsed.creatives || [];
                }
                catch (_c) {
                    log("error", "ai/creative", "Failed to parse creative response");
                    return [];
                }
            }
            return [];
        }
        catch (error) {
            log("error", "ai/creative", "Creative generation failed", { message: error instanceof Error ? error.message : "Unknown error" });
            return [];
        }
    });
}
