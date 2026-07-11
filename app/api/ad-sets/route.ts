import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { getActiveAdAccountScope } from "@/lib/account-scope"

export const dynamic = "force-dynamic"

const AdSetSchema = z.object({
  campaignId: z.string(),
  name: z.string().min(2),
  objective: z.string().optional(),
  targeting: z.unknown().optional(),
  placements: z.unknown().optional(),
  budgetAmount: z.number().min(0).optional(),
  budgetType: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const workspaceId = await getRequestWorkspaceId(userId, req)
  const scope = await getActiveAdAccountScope(userId, workspaceId, req.nextUrl.searchParams.get("adAccountId"))
  if (!scope) return NextResponse.json({ ok: true, adSets: [], accountRequired: true })
  const campaignId = new URL(req.url).searchParams.get("campaignId") || undefined
  const adSets = await prisma.adSet.findMany({
    where: { userId, workspaceId, ...(campaignId ? { campaignId } : {}), campaign: { adAccountId: scope.adAccountId } },
    include: { ads: true, campaign: { select: { id: true, name: true, platform: true } } },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({ ok: true, adSets })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const workspaceId = await getRequestWorkspaceId(userId, req)
  const scope = await getActiveAdAccountScope(userId, workspaceId)
  if (!scope) return NextResponse.json({ error: "Select an ad account before creating ad sets." }, { status: 409 })
  const parsed = AdSetSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  const campaign = await prisma.campaign.findFirst({ where: { id: parsed.data.campaignId, userId, workspaceId, adAccountId: scope.adAccountId } })
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })

  const adSet = await prisma.adSet.create({
    data: {
      workspaceId,
      userId,
      campaignId: campaign.id,
      name: parsed.data.name,
      objective: parsed.data.objective || campaign.objective,
      targeting: parsed.data.targeting as any,
      placements: parsed.data.placements as any,
      budgetAmount: parsed.data.budgetAmount,
      budgetType: parsed.data.budgetType,
      isLive: false,
    },
  })
  return NextResponse.json({ ok: true, adSet }, { status: 201 })
}
