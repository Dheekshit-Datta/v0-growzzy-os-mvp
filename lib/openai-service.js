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
const openai = new Proxy({}, {
    get: (_t, prop) => {
        if (!_openai)
            _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });
        return _openai[prop];
    },
});
// â”€â”€â”€ Retry Helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function withRetry(fn_1) {
    return __awaiter(this, arguments, void 0, function* (fn, maxRetries = 3, baseDelayMs = 1000) {
        var _a;
        let lastError;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return yield fn();
            }
            catch (err) {
                lastError = err;
                // Don't retry on auth / validation errors
                if ((err === null || err === void 0 ? void 0 : err.status) === 401 || (err === null || err === void 0 ? void 0 : err.status) === 400)
                    throw err;
                // Rate limit â€” respect retry-after
                if ((err === null || err === void 0 ? void 0 : err.status) === 429) {
                    const retryAfter = parseInt(((_a = err === null || err === void 0 ? void 0 : err.headers) === null || _a === void 0 ? void 0 : _a['retry-after']) || '5', 10);
                    yield new Promise(r => setTimeout(r, retryAfter * 1000));
                    continue;
                }
                // Exponential backoff
                if (attempt < maxRetries - 1) {
                    const delay = baseDelayMs * Math.pow(2, attempt);
                    yield new Promise(r => setTimeout(r, delay));
                }
            }
        }
        throw lastError;
    });
}
// â”€â”€â”€ OpenAI Request Logger â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function logOpenAIRequest(params) {
    return __awaiter(this, void 0, void 0, function* () {
        log(params.status === "error" ? "error" : "info", "ai/usage", "AI utility completed", Object.assign({ operation: params.type, model: params.model, tokens: params.tokens || 0, durationMs: params.durationMs || 0, cacheHit: false, userId: params.userId }, (params.error ? { error: params.error } : {})));
    });
}
// â”€â”€â”€ Key Validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function validateApiKey() {
    const key = process.env.OPENAI_API_KEY;
    if (!key || key === '' || key === 'placeholder' || key.includes('your_')) {
        throw new Error('OPENAI_API_KEY is not configured. Set it in your environment variables.');
    }
}
// â”€â”€â”€ Tool definitions for function calling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TOOLS = [
    {
        type: "function",
        function: {
            name: "analyze_campaign_performance",
            description: "Analyze campaign performance data and provide insights",
            parameters: {
                type: "object",
                properties: {
                    metrics: { type: "object", description: "Campaign metrics to analyze" },
                    timeframe: { type: "string", description: "Time period for analysis" },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "pause_campaigns",
            description: "Pause underperforming campaigns based on criteria",
            parameters: {
                type: "object",
                properties: {
                    criteria: { type: "object", description: "Criteria for pausing campaigns (e.g., ROAS < 1.0)" },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "adjust_campaign_budget",
            description: "Adjust budget for campaigns",
            parameters: {
                type: "object",
                properties: {
                    campaignId: { type: "string" },
                    adjustment: { type: "number", description: "Percentage to adjust" },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "generate_report",
            description: "Generate a performance report",
            parameters: {
                type: "object",
                properties: {
                    type: { type: "string", enum: ["daily", "weekly", "monthly"] },
                    dateRange: { type: "object" },
                },
            },
        },
    },
];
export class OpenAIService {
    /**
     * Chat with AI Copilot / Growth Assistant
     */
    static chat(messages, context, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            validateApiKey();
            const isReport = messages.some(m => m.content.toLowerCase().includes('report') ||
                m.content.toLowerCase().includes('insight') ||
                m.content.toLowerCase().includes('recommend'));
            const systemMessage = {
                role: "system",
                content: `You are GrowzzyOS AI (G-OS), a senior growth engineer. 
            
CONTEXT:
${context ? JSON.stringify(context, null, 2) : "No specific data provided."}

YOUR MANDATE:
- Provide data-driven, actionable marketing advice.
- When suggesting optimizations, specify exactly which campaign and what action (Pause, Increase Budget, Edit Creative).
- If the user asks for "insights" or "recommendations", provide a structured response including:
  1. Executive Summary
  2. High-Confidence Recommendations (Top 3)
  3. Predicted Impact
- Tone: Extremely outcome-oriented, professional, yet punchy.

${isReport ? 'IMPORTANT: Return your response in a well-structured markdown format with clear headers and bullet points. Use tables for metrics.' : ''}`
            };
            const start = Date.now();
            const promptText = messages.map(m => m.content).join('\n');
            try {
                const response = yield withRetry(() => openai.chat.completions.create({
                    model: UTILITY_MODEL,
                    messages: [systemMessage, ...messages],
                    tools: TOOLS,
                    tool_choice: "auto",
                    temperature: 0.7,
                    response_format: isReport ? { type: "text" } : { type: "text" },
                }));
                const durationMs = Date.now() - start;
                const content = ((_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || '';
                if (userId) {
                    yield logOpenAIRequest({
                        userId,
                        type: 'chat',
                        model: UTILITY_MODEL,
                        prompt: promptText,
                        response: content,
                        status: 'success',
                        tokens: (_c = response.usage) === null || _c === void 0 ? void 0 : _c.total_tokens,
                        durationMs,
                    });
                }
                return response;
            }
            catch (error) {
                if (userId) {
                    yield logOpenAIRequest({
                        userId,
                        type: 'chat',
                        model: UTILITY_MODEL,
                        prompt: promptText,
                        status: 'error',
                        error: error.message,
                        durationMs: Date.now() - start,
                    });
                }
                log("error", "ai/chat", "OpenAI chat failed", { message: (error === null || error === void 0 ? void 0 : error.message) || "Unknown error" });
                throw new Error(`AI Engine Error: ${error.message}`);
            }
        });
    }
    /**
     * Generate AI insights from campaign data
     */
    static generateInsights(data, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            validateApiKey();
            const prompt = `You are an expert marketing analyst. Analyze this campaign data and provide 3-5 actionable insights.

Data:
- Total Campaigns: ${data.campaigns.length}
- Metrics: ${JSON.stringify(data.metrics)}
- Timeframe: ${data.timeframe}

Campaign Details:
${data.campaigns.map((c, i) => `${i + 1}. ${c.name}: Spend $${c.spend}, Revenue $${c.revenue}, ROAS ${c.roas}x`).join("\n")}

Provide insights in this JSON format:
{
  "insights": [
    {
      "title": "Brief title",
      "description": "Detailed insight",
      "type": "WARNING | OPPORTUNITY | INFO",
      "severity": "HIGH | MEDIUM | LOW",
      "metric": "affected metric",
      "recommendation": "What to do"
    }
  ]
}`;
            const start = Date.now();
            try {
                const response = yield withRetry(() => openai.chat.completions.create({
                    model: UTILITY_MODEL,
                    messages: [{ role: "user", content: prompt }],
                    response_format: { type: "json_object" },
                    temperature: 0.3,
                }));
                const content = (_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content;
                if (userId) {
                    yield logOpenAIRequest({
                        userId, type: 'insights', model: UTILITY_MODEL,
                        prompt, response: content || '',
                        status: 'success',
                        tokens: (_c = response.usage) === null || _c === void 0 ? void 0 : _c.total_tokens,
                        durationMs: Date.now() - start,
                    });
                }
                return content ? JSON.parse(content) : { insights: [] };
            }
            catch (error) {
                if (userId) {
                    yield logOpenAIRequest({
                        userId, type: 'insights', model: UTILITY_MODEL,
                        prompt, status: 'error', error: error.message,
                        durationMs: Date.now() - start,
                    });
                }
                log("error", "ai/insights", "OpenAI insights failed", { message: (error === null || error === void 0 ? void 0 : error.message) || "Unknown error" });
                return { insights: [] };
            }
        });
    }
    /**
     * Generate AI-powered ad creatives (Production Version)
     */
    static generateProductionCreatives(params, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            validateApiKey();
            const prompt = `You are an award-winning direct-response copywriter and ad creative designer. Produce JSON output only.

INPUT:
- Product: ${params.productName}
- Brand: ${params.brand}
- Short Description: ${params.shortDescription}
- Audience: ${params.targetAudience}
- Objective: ${params.objective}
- Platforms: ${params.platforms.join(', ')}
- Tones: ${((_a = params.tones) === null || _a === void 0 ? void 0 : _a.join(', ')) || 'Professional'}
- Required keywords: ${((_b = params.keywords) === null || _b === void 0 ? void 0 : _b.join(', ')) || 'None'}
- Preferred CTA: ${params.cta || 'Auto'}

PLATFORM CONSTRAINTS:
- Meta: Primary text â‰¤125 chars, Headline â‰¤40 chars.
- Google: Headline â‰¤30 chars, Description â‰¤90 chars.

TASK:
Generate ${params.numVariations || 3} unique variations. 
For each variation return a structured object that works across the selected platforms.

Return JSON format:
{
  "creatives": [
    {
      "title": "Creative Title (internal)",
      "headline": "Main headline",
      "primaryText": "Body copy",
      "description": "Short description/sub-headline",
      "cta": "Recommended CTA",
      "creativeBrief": "Detailed visual brief for image generation (photorealistic, style, colors, composition)",
      "keywords": ["tag1", "tag2", "tag3"],
      "predictedScore": 0.92,
      "reasoning": "Why this specific copy works for the target audience"
    }
  ]
}`;
            const start = Date.now();
            try {
                const response = yield withRetry(() => openai.chat.completions.create({
                    model: process.env.OPENAI_CREATIVE_MODEL || "gpt-4o",
                    messages: [
                        { role: "system", content: "You are a senior ad specialist. Always respect character limits. Output valid JSON only." },
                        { role: "user", content: prompt }
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0.8,
                }));
                const content = (_d = (_c = response.choices[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content;
                if (userId) {
                    yield logOpenAIRequest({
                        userId, type: 'creative-prod', model: process.env.OPENAI_CREATIVE_MODEL || "gpt-4o",
                        prompt, response: content || '',
                        status: 'success',
                        tokens: (_e = response.usage) === null || _e === void 0 ? void 0 : _e.total_tokens,
                        durationMs: Date.now() - start,
                    });
                }
                const result = content ? JSON.parse(content) : { creatives: [] };
                // Ensure result has creatives array
                return Array.isArray(result.creatives) ? result : { creatives: [] };
            }
            catch (error) {
                if (userId) {
                    yield logOpenAIRequest({
                        userId, type: 'creative-prod', model: process.env.OPENAI_CREATIVE_MODEL || "gpt-4o",
                        prompt, status: 'error', error: error.message,
                        durationMs: Date.now() - start,
                    });
                }
                log("error", "ai/creative", "OpenAI creative generation failed", { message: (error === null || error === void 0 ? void 0 : error.message) || "Unknown error" });
                throw error;
            }
        });
    }
    /**
     * Generate executive report summary
     */
    static generateReportSummary(data, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            validateApiKey();
            const prompt = `You are a marketing strategist writing an executive summary.

Performance Data (${data.dateRange.from} to ${data.dateRange.to}):
- Total Spend: $${data.metrics.totalSpend}
- Total Revenue: $${data.metrics.totalRevenue}
- Overall ROAS: ${data.metrics.roas}x
- Total Leads: ${data.metrics.totalLeads}
- Top Campaign: ${(_a = data.campaigns[0]) === null || _a === void 0 ? void 0 : _a.name}

Write a concise 3-paragraph executive summary covering:
1. Overall performance vs goals
2. Key wins and challenges
3. Strategic recommendations for next period

Keep it professional, data-driven, and actionable.`;
            const start = Date.now();
            try {
                const response = yield withRetry(() => openai.chat.completions.create({
                    model: UTILITY_MODEL,
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.5,
                }));
                const content = ((_c = (_b = response.choices[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) || "";
                if (userId) {
                    yield logOpenAIRequest({
                        userId, type: 'report', model: UTILITY_MODEL,
                        prompt, response: content,
                        status: 'success',
                        tokens: (_d = response.usage) === null || _d === void 0 ? void 0 : _d.total_tokens,
                        durationMs: Date.now() - start,
                    });
                }
                return content;
            }
            catch (error) {
                if (userId) {
                    yield logOpenAIRequest({
                        userId, type: 'report', model: UTILITY_MODEL,
                        prompt, status: 'error', error: error.message,
                        durationMs: Date.now() - start,
                    });
                }
                log("error", "ai/report", "OpenAI report summary failed", { message: (error === null || error === void 0 ? void 0 : error.message) || "Unknown error" });
                return "Report summary unavailable.";
            }
        });
    }
    /**
     * AI Lead Scoring
     */
    static scoreLead(lead, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            validateApiKey();
            const prompt = `Score this lead from 0-100 based on conversion likelihood:

Lead Data:
- Company: ${lead.company || "Unknown"}
- Email Domain: ${((_a = lead.email) === null || _a === void 0 ? void 0 : _a.split("@")[1]) || "Unknown"}
- Source: ${lead.source || "Unknown"}
- Estimated Value: $${lead.value || 0}

Consider:
- Email domain quality (corporate vs free email)
- Company presence
- Source reliability
- Value potential

Return JSON: { "score": 85, "reasoning": "Why this score" }`;
            const start = Date.now();
            try {
                const response = yield withRetry(() => openai.chat.completions.create({
                    model: UTILITY_MODEL,
                    messages: [{ role: "user", content: prompt }],
                    response_format: { type: "json_object" },
                    temperature: 0.3,
                }));
                const content = (_c = (_b = response.choices[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content;
                if (userId) {
                    yield logOpenAIRequest({
                        userId, type: 'lead-score', model: UTILITY_MODEL,
                        prompt, response: content || '',
                        status: 'success',
                        tokens: (_d = response.usage) === null || _d === void 0 ? void 0 : _d.total_tokens,
                        durationMs: Date.now() - start,
                    });
                }
                const result = content ? JSON.parse(content) : { score: 50, reasoning: "Default" };
                return result;
            }
            catch (error) {
                if (userId) {
                    yield logOpenAIRequest({
                        userId, type: 'lead-score', model: UTILITY_MODEL,
                        prompt, status: 'error', error: error.message,
                        durationMs: Date.now() - start,
                    });
                }
                log("error", "ai/lead-score", "OpenAI lead scoring failed", { message: (error === null || error === void 0 ? void 0 : error.message) || "Unknown error" });
                return { score: 50, reasoning: "Auto-assigned default score" };
            }
        });
    }
}
