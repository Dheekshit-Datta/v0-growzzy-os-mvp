import OpenAI from "openai"
import { UTILITY_MODEL } from "@/lib/ai-utility"
import { log } from "@/lib/logger"

let _openai: OpenAI | null = null
const openai = new Proxy({} as OpenAI, {
  get: (_t, prop) => {
    if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })
    return (_openai as any)[prop]
  },
})

// â”€â”€â”€ Retry Helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelayMs = 1000): Promise<T> {
    let lastError: any
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn()
        } catch (err: any) {
            lastError = err
            // Don't retry on auth / validation errors
            if (err?.status === 401 || err?.status === 400) throw err
            // Rate limit â€” respect retry-after
            if (err?.status === 429) {
                const retryAfter = parseInt(err?.headers?.['retry-after'] || '5', 10)
                await new Promise(r => setTimeout(r, retryAfter * 1000))
                continue
            }
            // Exponential backoff
            if (attempt < maxRetries - 1) {
                const delay = baseDelayMs * Math.pow(2, attempt)
                await new Promise(r => setTimeout(r, delay))
            }
        }
    }
    throw lastError
}

// â”€â”€â”€ OpenAI Request Logger â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function logOpenAIRequest(params: {
    userId: string
    type: string
    model: string
    prompt: string
    response?: string
    status: 'success' | 'error'
    tokens?: number
    durationMs?: number
    error?: string
}) {
    log(params.status === "error" ? "error" : "info", "ai/usage", "AI utility completed", {
        operation: params.type,
        model: params.model,
        tokens: params.tokens || 0,
        durationMs: params.durationMs || 0,
        cacheHit: false,
        userId: params.userId,
        ...(params.error ? { error: params.error } : {}),
    })
}

// â”€â”€â”€ Key Validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function validateApiKey(): void {
    const key = process.env.OPENAI_API_KEY
    if (!key || key === '' || key === 'placeholder' || key.includes('your_')) {
        throw new Error('OPENAI_API_KEY is not configured. Set it in your environment variables.')
    }
}

// â”€â”€â”€ Tool definitions for function calling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const TOOLS = [
    {
        type: "function" as const,
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
        type: "function" as const,
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
        type: "function" as const,
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
        type: "function" as const,
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
]

export class OpenAIService {
    /**
     * Chat with AI Copilot / Growth Assistant
     */
    static async chat(messages: { role: string; content: string }[], context?: any, userId?: string) {
        validateApiKey()

        const isReport = messages.some(m => 
          m.content.toLowerCase().includes('report') || 
          m.content.toLowerCase().includes('insight') ||
          m.content.toLowerCase().includes('recommend')
        )

        const systemMessage = {
            role: "system",
            content: `You are GrowzzyOS AI (G-OS), a senior growth engineer. 
            
CONTEXT:
${context ? JSON.stringify(context, null, 2) : "No specific data provided."}

YOUR MANDATE:
- Answer the user's actual question directly, whether it is about marketing, business, campaigns, reporting, research, or general Growzzy OS usage. Do not force every message into a campaign template or ask a form-style question.
- Use My Brand context as the source of truth. Never ask what the business is when brand_context already answers it; never invent missing facts.
- For campaign work, ask one material clarification at a time in plain language and accept free-text answers. Only recommend or plan for Google and Meta; never offer LinkedIn.
- Provide data-driven, actionable marketing advice.
- When suggesting optimizations, specify exactly which campaign and what action (Pause, Increase Budget, Edit Creative).
- If the user asks for "insights" or "recommendations", provide a structured response including:
  1. Executive Summary
  2. High-Confidence Recommendations (Top 3)
  3. Predicted Impact
- Tone: Extremely outcome-oriented, professional, yet punchy.

${isReport ? 'IMPORTANT: Return your response in a well-structured markdown format with clear headers and bullet points. Use tables for metrics.' : ''}`
        }

        const start = Date.now()
        const promptText = messages.map(m => m.content).join('\n')

        try {
            const response = await withRetry(() =>
                openai.chat.completions.create({
                    model: UTILITY_MODEL,
                    messages: [systemMessage, ...messages] as any,
                    tools: TOOLS,
                    tool_choice: "auto",
                    temperature: 0.7,
                    response_format: isReport ? { type: "text" } : { type: "text" }, 
                })
            )

            const durationMs = Date.now() - start
            const content = response.choices[0]?.message?.content || ''

            if (userId) {
                await logOpenAIRequest({
                    userId,
                    type: 'chat',
                    model: UTILITY_MODEL,
                    prompt: promptText,
                    response: content,
                    status: 'success',
                    tokens: response.usage?.total_tokens,
                    durationMs,
                })
            }

            return response
        } catch (error: any) {
            if (userId) {
                await logOpenAIRequest({
                    userId,
                    type: 'chat',
                    model: UTILITY_MODEL,
                    prompt: promptText,
                    status: 'error',
                    error: error.message,
                    durationMs: Date.now() - start,
                })
            }
            log("error", "ai/chat", "OpenAI chat failed", { message: error?.message || "Unknown error" })
            throw new Error(`AI Engine Error: ${error.message}`)
        }
    }

    /**
     * Generate AI insights from campaign data
     */
    static async generateInsights(data: {
        campaigns: any[]
        metrics: any
        timeframe: string
    }, userId?: string) {
        validateApiKey()

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
}`

        const start = Date.now()
        try {
            const response = await withRetry(() =>
                openai.chat.completions.create({
                    model: UTILITY_MODEL,
                    messages: [{ role: "user", content: prompt }],
                    response_format: { type: "json_object" },
                    temperature: 0.3,
                })
            )

            const content = response.choices[0]?.message?.content

            if (userId) {
                await logOpenAIRequest({
                    userId, type: 'insights', model: UTILITY_MODEL,
                    prompt, response: content || '',
                    status: 'success',
                    tokens: response.usage?.total_tokens,
                    durationMs: Date.now() - start,
                })
            }

            return content ? JSON.parse(content) : { insights: [] }
        } catch (error: any) {
            if (userId) {
                await logOpenAIRequest({
                    userId, type: 'insights', model: UTILITY_MODEL,
                    prompt, status: 'error', error: error.message,
                    durationMs: Date.now() - start,
                })
            }
            log("error", "ai/insights", "OpenAI insights failed", { message: error?.message || "Unknown error" })
            return { insights: [] }
        }
    }

    /**
     * Generate AI-powered ad creatives (Production Version)
     */
    static async generateProductionCreatives(params: {
        productName: string
        brand: string
        shortDescription: string
        targetAudience: string
        objective: string
        platforms: string[]
        numVariations: number
        tones?: string[]
        keywords?: string[]
        cta?: string
    }, userId?: string) {
        validateApiKey()

        const prompt = `You are an award-winning direct-response copywriter and ad creative designer. Produce JSON output only.

INPUT:
- Product: ${params.productName}
- Brand: ${params.brand}
- Short Description: ${params.shortDescription}
- Audience: ${params.targetAudience}
- Objective: ${params.objective}
- Platforms: ${params.platforms.join(', ')}
- Tones: ${params.tones?.join(', ') || 'Professional'}
- Required keywords: ${params.keywords?.join(', ') || 'None'}
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
}`

        const start = Date.now()
        try {
            const response = await withRetry(() =>
                openai.chat.completions.create({
                    model: process.env.OPENAI_CREATIVE_MODEL || "gpt-4o",
                    messages: [
                        { role: "system", content: "You are a senior ad specialist. Always respect character limits. Output valid JSON only." },
                        { role: "user", content: prompt }
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0.8,
                })
            )

            const content = response.choices[0]?.message?.content

            if (userId) {
                await logOpenAIRequest({
                    userId, type: 'creative-prod', model: process.env.OPENAI_CREATIVE_MODEL || "gpt-4o",
                    prompt, response: content || '',
                    status: 'success',
                    tokens: response.usage?.total_tokens,
                    durationMs: Date.now() - start,
                })
            }

            const result = content ? JSON.parse(content) : { creatives: [] }
            // Ensure result has creatives array
            return Array.isArray(result.creatives) ? result : { creatives: [] }
        } catch (error: any) {
            if (userId) {
                await logOpenAIRequest({
                    userId, type: 'creative-prod', model: process.env.OPENAI_CREATIVE_MODEL || "gpt-4o",
                    prompt, status: 'error', error: error.message,
                    durationMs: Date.now() - start,
                })
            }
            log("error", "ai/creative", "OpenAI creative generation failed", { message: error?.message || "Unknown error" })
            throw error
        }
    }

    /**
     * Generate executive report summary
     */
    static async generateReportSummary(data: {
        metrics: any
        campaigns: any[]
        dateRange: { from: string; to: string }
    }, userId?: string) {
        validateApiKey()

        const prompt = `You are a marketing strategist writing an executive summary.

Performance Data (${data.dateRange.from} to ${data.dateRange.to}):
- Total Spend: $${data.metrics.totalSpend}
- Total Revenue: $${data.metrics.totalRevenue}
- Overall ROAS: ${data.metrics.roas}x
- Total Leads: ${data.metrics.totalLeads}
- Top Campaign: ${data.campaigns[0]?.name}

Write a concise 3-paragraph executive summary covering:
1. Overall performance vs goals
2. Key wins and challenges
3. Strategic recommendations for next period

Keep it professional, data-driven, and actionable.`

        const start = Date.now()
        try {
            const response = await withRetry(() =>
                openai.chat.completions.create({
                    model: UTILITY_MODEL,
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.5,
                })
            )

            const content = response.choices[0]?.message?.content || ""

            if (userId) {
                await logOpenAIRequest({
                    userId, type: 'report', model: UTILITY_MODEL,
                    prompt, response: content,
                    status: 'success',
                    tokens: response.usage?.total_tokens,
                    durationMs: Date.now() - start,
                })
            }

            return content
        } catch (error: any) {
            if (userId) {
                await logOpenAIRequest({
                    userId, type: 'report', model: UTILITY_MODEL,
                    prompt, status: 'error', error: error.message,
                    durationMs: Date.now() - start,
                })
            }
            log("error", "ai/report", "OpenAI report summary failed", { message: error?.message || "Unknown error" })
            return "Report summary unavailable."
        }
    }

    /**
     * AI Lead Scoring
     */
    static async scoreLead(lead: {
        company?: string
        email?: string
        source?: string
        value?: number
    }, userId?: string) {
        validateApiKey()

        const prompt = `Score this lead from 0-100 based on conversion likelihood:

Lead Data:
- Company: ${lead.company || "Unknown"}
- Email Domain: ${lead.email?.split("@")[1] || "Unknown"}
- Source: ${lead.source || "Unknown"}
- Estimated Value: $${lead.value || 0}

Consider:
- Email domain quality (corporate vs free email)
- Company presence
- Source reliability
- Value potential

Return JSON: { "score": 85, "reasoning": "Why this score" }`

        const start = Date.now()
        try {
            const response = await withRetry(() =>
                openai.chat.completions.create({
                    model: UTILITY_MODEL,
                    messages: [{ role: "user", content: prompt }],
                    response_format: { type: "json_object" },
                    temperature: 0.3,
                })
            )

            const content = response.choices[0]?.message?.content

            if (userId) {
                await logOpenAIRequest({
                    userId, type: 'lead-score', model: UTILITY_MODEL,
                    prompt, response: content || '',
                    status: 'success',
                    tokens: response.usage?.total_tokens,
                    durationMs: Date.now() - start,
                })
            }

            const result = content ? JSON.parse(content) : { score: 50, reasoning: "Default" }
            return result
        } catch (error: any) {
            if (userId) {
                await logOpenAIRequest({
                    userId, type: 'lead-score', model: UTILITY_MODEL,
                    prompt, status: 'error', error: error.message,
                    durationMs: Date.now() - start,
                })
            }
            log("error", "ai/lead-score", "OpenAI lead scoring failed", { message: error?.message || "Unknown error" })
            return { score: 50, reasoning: "Auto-assigned default score" }
        }
    }
}
