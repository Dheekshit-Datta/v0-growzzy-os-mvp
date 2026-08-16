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
import { UTILITY_MODEL } from "@/lib/ai-utility";
import { log } from "@/lib/logger";
let _openai = null;
function getOpenAI() {
    if (!_openai)
        _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });
    return _openai;
}
// ============================================
// AI COPILOT - Chat Completion
// ============================================
export function chatWithAI(messages) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!process.env.OPENAI_API_KEY)
            return { success: false, error: "OPENAI_API_KEY is not configured. AI responses are unavailable." };
        try {
            const response = yield getOpenAI().chat.completions.create({
                model: UTILITY_MODEL,
                messages: messages,
                temperature: 0.7,
                max_tokens: 1500,
            });
            return { success: true, message: response.choices[0].message.content, usage: response.usage };
        }
        catch (error) {
            log("error", "ai/chat", "OpenAI chat failed", { message: (error === null || error === void 0 ? void 0 : error.message) || "Unknown error" });
            return { success: false, error: error.message || "AI service unavailable" };
        }
    });
}
// ============================================
// AI ANALYTICS INSIGHTS
// ============================================
export function generateAnalyticsInsights(analyticsData) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!process.env.OPENAI_API_KEY)
            return { success: false, error: "API Key missing" };
        try {
            const prompt = `You are an expert marketing analyst. Analyze the following marketing data and provide 3-5 key insights with actionable recommendations:
Data: ${JSON.stringify(analyticsData, null, 2)}
Return in JSON: { insights: [{type, title, description, priority}], recommendations: [{title, description, impact}] }`;
            const response = yield getOpenAI().chat.completions.create({
                model: UTILITY_MODEL,
                messages: [
                    { role: "system", content: "You are a senior marketing analyst specializing in multi-platform advertising optimization." },
                    { role: "user", content: prompt },
                ],
                response_format: { type: "json_object" },
                temperature: 0.3,
            });
            const result = JSON.parse(response.choices[0].message.content || "{}");
            return { success: true, data: result };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
// ============================================
// AI AD CREATIVE GENERATION
// ============================================
export function generateAdCreative(params) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!process.env.OPENAI_API_KEY)
            return { success: false, error: "API Key missing" };
        try {
            const prompt = `Generate 3 high-converting ad creative variations for: ${JSON.stringify(params)}
Return in JSON format: { creatives: [{headline, body, cta, visualSuggestion, predictionScore, reasoning}] }`;
            const response = yield getOpenAI().chat.completions.create({
                model: process.env.OPENAI_CREATIVE_MODEL || "gpt-4o",
                messages: [
                    { role: "system", content: "You are a world-class performance marketing copywriter." },
                    { role: "user", content: prompt },
                ],
                response_format: { type: "json_object" },
                temperature: 0.8,
            });
            const result = JSON.parse(response.choices[0].message.content || "{}");
            return { success: true, data: result };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
// ============================================
// AI LEAD SCORING
// ============================================
export function scoreLeads(leads) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!process.env.OPENAI_API_KEY)
            return { success: false, error: "OPENAI_API_KEY is not configured. Lead scoring is unavailable." };
        try {
            const prompt = `Score these leads (0-100) based on quality indicators: ${JSON.stringify(leads)}
Return JSON: { scores: [{id, score, reasoning, nextBestAction}] }`;
            const response = yield getOpenAI().chat.completions.create({
                model: UTILITY_MODEL,
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" },
                temperature: 0.2,
            });
            const result = JSON.parse(response.choices[0].message.content || "{}");
            return { success: true, data: result };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
// ============================================
// AI REPORT GENERATION
// ============================================
export function generateReportSummary(reportData, type) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!process.env.OPENAI_API_KEY)
            return "AI summary unavailable for this report.";
        try {
            const prompt = `Generate a 3-paragraph executive summary for a ${type} report based on this data: ${JSON.stringify(reportData)}`;
            const response = yield getOpenAI().chat.completions.create({
                model: UTILITY_MODEL,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.5,
                max_tokens: 800,
            });
            return response.choices[0].message.content;
        }
        catch (error) {
            return "AI summary unavailable for this report.";
        }
    });
}
// ============================================
// AI CAMPAIGN ANALYSIS
// ============================================
export function analyzeCampaign(campaign) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!process.env.OPENAI_API_KEY)
            return { success: false, error: "OPENAI_API_KEY is not configured. Campaign analysis is unavailable." };
        try {
            const prompt = `Analyze this campaign and provide a health status (Excellent, Good, Fair, Critical) and recommendations: ${JSON.stringify(campaign)}
Return in JSON format: { health, recommendations, potentialRoas }`;
            const response = yield getOpenAI().chat.completions.create({
                model: UTILITY_MODEL,
                messages: [
                    { role: "system", content: "You are a senior performance marketing analyst." },
                    { role: "user", content: prompt },
                ],
                response_format: { type: "json_object" },
                temperature: 0.3,
            });
            const result = JSON.parse(response.choices[0].message.content || "{}");
            return { success: true, data: result };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
export { getOpenAI };
