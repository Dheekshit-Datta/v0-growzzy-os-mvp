import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { getActiveAdAccountScope } from "@/lib/account-scope"
import { verifiedMetricCampaignWhere } from "@/lib/data-trust"
import OpenAI from "openai"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"
import { UTILITY_MODEL } from "@/lib/ai-utility"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" })

export const dynamic = "force-dynamic"

function money(value: number) {
  return `$${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const userId = await resolveUserId(session.user.id)
  const limit = await rateLimitPolicy(userId, "aiUtility")
  if (!limit.allowed) return rateLimitResponse(limit)
  if (!process.env.OPENAI_API_KEY) {
    return new Response("AI assistant is unavailable because OPENAI_API_KEY is not configured.", { status: 503 })
  }

  const workspaceId = await getRequestWorkspaceId(userId, req as any)
  const scope = await getActiveAdAccountScope(userId, workspaceId)
  const body = await req.json().catch(() => ({}))
  const rawMessages = Array.isArray(body.messages)
    ? body.messages
    : body.message
      ? [{ role: "user", content: String(body.message) }]
      : []
  const messages = rawMessages
    .map((message: any) => ({
      role: message?.role === "assistant" ? "assistant" : "user",
      content: String(message?.content || ""),
    }))
    .filter((message: { content: string }) => message.content.trim().length > 0)

  const [campaigns, integrations] = scope ? await Promise.all([
    prisma.campaign.findMany({
      where: verifiedMetricCampaignWhere({ userId, workspaceId, adAccountId: scope.adAccountId }),
      orderBy: { spend: "desc" },
      take: 100,
    }),
    prisma.integration.findMany({
      where: { userId, workspaceId, id: scope.integrationId },
      select: { platform: true, lastSyncAt: true },
      take: 1,
    }),
  ]) : [[], []]

  const totalSpend = campaigns.reduce((sum, c) => sum + Number(c.spend || 0), 0)
  const totalImpressions = campaigns.reduce((sum, c) => sum + Number(c.impressions || 0), 0)
  const totalConversions = campaigns.reduce((sum, c) => sum + Number(c.conversions || 0), 0)
  const avgRoas = campaigns.length
    ? campaigns.reduce((sum, c) => sum + Number(c.roas || 0), 0) / campaigns.length
    : 0

  const platformList = integrations.map((integration) => integration.platform).join(", ") || "None"
  const campaignBreakdown = campaigns
    .map(
      (campaign) =>
        `Campaign: ${campaign.name} | Status: ${campaign.status} | Spend: ${money(campaign.spend)} | ROAS: ${Number(
          campaign.roas || 0
        ).toFixed(2)}x | CTR: ${Number(campaign.ctr || 0).toFixed(2)}% | CPC: ${money(campaign.cpc || 0)} | Conversions: ${Number(
          campaign.conversions || 0
        )} | Budget: ${money(campaign.budgetAmount || 0)}`
    )
    .join("\n")

  const systemPrompt = `You are GROWZY AI, an expert performance marketing analyst and Google Ads strategist embedded inside GROWZZY OS - an AI marketing platform for SMMA agencies.

You have access to the user's LIVE campaign data:

ACCOUNT SUMMARY:
- Total Campaigns: ${campaigns.length}
- Total Spend (Last 30 days): ${money(totalSpend)}
- Total Impressions: ${totalImpressions.toLocaleString()}
- Total Conversions: ${totalConversions.toLocaleString()}
- Average ROAS: ${avgRoas.toFixed(2)}x
- Connected Platforms: ${platformList}

CAMPAIGN BREAKDOWN:
${campaignBreakdown || "No campaigns available"}

INSTRUCTIONS:
- Answer questions about this specific account with real numbers from the data above
- Give specific, actionable recommendations with exact campaign names and numbers
- When asked about best/worst performers, reference actual campaign names
- Suggest budget reallocation with specific dollar amounts
- If asked to generate a report, structure it clearly
- Be concise but thorough. Use bullet points for recommendations.
- Always reference specific campaign names, never say "your campaigns" generically
- Format currency as USD, show ROAS as Xx format`

  const stream = await openai.chat.completions.create({
    model: UTILITY_MODEL,
    stream: true,
    temperature: 0.4,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta?.content
          if (delta) controller.enqueue(encoder.encode(delta))
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  })
}
