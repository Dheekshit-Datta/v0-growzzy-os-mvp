import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { OpenAIService } from "@/lib/openai-service"
import { NextRequest, NextResponse } from "next/server"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId, workspaceWhere } from "@/lib/workspace"
import { verifiedMetricCampaignWhere } from "@/lib/data-trust"
import { getActiveAdAccountScope } from "@/lib/account-scope"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey || apiKey === "placeholder" || apiKey.includes("your_") || apiKey === "") {
      return NextResponse.json({
        message: {
          role: "assistant",
          content: "I'm currently offline because the OpenAI API key is not configured. Please ask your admin to set the OPENAI_API_KEY environment variable.",
        },
        context_used: false,
        error_code: "OPENAI_NOT_CONFIGURED",
      })
    }

    const { messages, conversationId } = await req.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 })
    }

    const userId = await resolveUserId(session.user.id)
    const limit = await rateLimitPolicy(userId, "aiUtility")
    if (!limit.allowed) return rateLimitResponse(limit)
    const workspaceId = await getRequestWorkspaceId(userId, req)
    const workspaceFilter = workspaceWhere(workspaceId, false)
    const scope = await getActiveAdAccountScope(userId, workspaceId, req.nextUrl.searchParams.get("adAccountId"))

    const integrations = scope ? await prisma.integration.findMany({
      where: { userId, ...workspaceFilter, id: scope.integrationId },
      select: { platform: true, selectedAdAccountName: true, lastSyncAt: true, selectedAdAccountId: true, accountId: true },
    }) : []
    const [campaigns, recentLeads] = scope ? await Promise.all([
      prisma.campaign.findMany({
        where: verifiedMetricCampaignWhere({ userId, workspaceId, adAccountId: scope.adAccountId }),
        select: {
          name: true,
          status: true,
          spend: true,
          revenue: true,
          roas: true,
          budgetAmount: true,
          objective: true,
          platform: true,
        },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
      prisma.lead.count({
        where: {
          userId,
          ...workspaceFilter,
          adAccountId: scope.adAccountId,
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]) : [[], 0]

    const totalSpend = campaigns.reduce((acc, c) => acc + Number(c.spend || 0), 0)
    const totalRevenue = campaigns.reduce((acc, c) => acc + Number(c.revenue || 0), 0)
    const avgRoas = totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : "0.00"

    const context = {
      summary: {
        total_active_campaigns: campaigns.filter((c) => c.status === "ACTIVE").length,
        total_campaigns: campaigns.length,
        total_spend_30d: totalSpend,
        total_revenue_30d: totalRevenue,
        account_roas: avgRoas,
        new_leads_30d: recentLeads,
        connected_platforms: integrations.map((p) => p.platform).join(", ") || "None",
      },
      campaigns_snapshot: campaigns.map((c) => ({
        name: c.name,
        status: c.status,
        spend: c.spend,
        revenue: c.revenue,
        roas: c.roas,
        budget: c.budgetAmount,
        objective: c.objective,
        platform: c.platform,
      })),
      connected_platforms: integrations,
    }

    const response = await OpenAIService.chat(messages, context, userId)
    const assistantMessage = response.choices[0]?.message

    if (conversationId) {
      try {
        await prisma.conversation.update({
          where: { id: conversationId, userId },
          data: {
            messages: [...messages, assistantMessage] as any,
            updatedAt: new Date(),
          },
        })
      } catch {
        await prisma.conversation.create({
          data: {
            id: conversationId,
            userId,
            title: messages[0]?.content?.substring(0, 50) || "New Conversation",
            messages: [...messages, assistantMessage] as any,
          },
        }).catch(() => {})
      }
    }

    return NextResponse.json({
      message: assistantMessage,
      context_used: true,
    })
  } catch (error: any) {
    console.error("AI Assistant Error:", error)

    const msg = error?.message || ""
    let userMessage = "I encountered an unexpected error. Please try again in a moment."

    if (msg.includes("API key") || msg.includes("OPENAI_API_KEY")) {
      userMessage = "I'm currently offline because the OpenAI API key is not configured. Please contact your administrator."
    } else if (msg.includes("Can't reach") || msg.includes("database")) {
      userMessage = "I'm having trouble accessing the database. Please try again in a moment."
    } else if (msg.includes("timeout") || msg.includes("timed out")) {
      userMessage = "My response took too long. Please try a shorter question."
    }

    return NextResponse.json({
      message: {
        role: "assistant",
        content: userMessage,
      },
      context_used: false,
      error: true,
    })
  }
}
