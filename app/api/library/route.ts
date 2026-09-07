import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"

export const dynamic = "force-dynamic"

/**
 * Library endpoint — returns the user's saved work across three buckets:
 *   - creatives   → rows from the `Creative` model
 *   - campaigns   → rows from the `Campaign` model
 *   - artifacts   → ad-copy & creative tool outputs parsed out of saved Conversation messages
 *
 * No fake data. Empty arrays when the user has nothing yet.
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = await resolveUserId(session.user.id)

  const [creatives, campaigns, generated, conversations] = await Promise.all([
    prisma.creative.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.campaign.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        name: true,
        platform: true,
        status: true,
        objective: true,
        budgetDaily: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.generatedCreative.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, messages: true, updatedAt: true, createdAt: true, title: true },
    }),
  ])

  // Parse conversation messages for tool outputs (deliverCampaign, generateCreative)
  type ParsedArtifact = {
    id: string
    kind: "campaign" | "creative" | "copy"
    title: string
    platform: string
    preview: string
    source: string
    createdAt: string
  }
  const artifacts: ParsedArtifact[] = []
  for (const conv of conversations) {
    const msgs = (conv.messages as any[]) || []
    for (const m of msgs) {
      if (!m?.parts) continue
      for (const p of m.parts) {
        if (typeof p?.type !== "string") continue
        if (!p.type.startsWith("tool-")) continue
        if (p.state !== "output-available" || !p.output) continue
        const out: any = p.output
        if (p.type === "tool-deliverCampaign" && out?.name) {
          const headlines: string[] = Array.isArray(out.headlines)
            ? out.headlines.map((h: any) => String(typeof h === "string" ? h : h?.text ?? "")).filter(Boolean)
            : []
          artifacts.push({
            id: `${conv.id}:${p.toolCallId ?? Math.random()}`,
            kind: "campaign",
            title: String(out.name),
            platform: String(out.platform ?? ""),
            preview: headlines[0] || out.primaryText || out.summary || "Campaign package",
            source: `chat:${conv.id}`,
            createdAt: (conv.updatedAt instanceof Date ? conv.updatedAt : new Date(conv.updatedAt as any)).toISOString(),
          })
        } else if (p.type === "tool-generateCreative") {
          const imageUrl: string | undefined = out?.imageUrl || (Array.isArray(out?.imageUrls) ? out.imageUrls[0] : undefined)
          artifacts.push({
            id: `${conv.id}:${p.toolCallId ?? Math.random()}`,
            kind: imageUrl ? "creative" : "copy",
            title: out?.caption || "Ad creative",
            platform: out?.platform || "",
            preview: imageUrl || out?.caption || "Ad creative",
            source: `chat:${conv.id}`,
            createdAt: (conv.updatedAt instanceof Date ? conv.updatedAt : new Date(conv.updatedAt as any)).toISOString(),
          })
        }
      }
    }
  }

  // Normalise Creatives
  const normalisedCreatives = creatives.map((c) => ({
    id: c.id,
    name: c.name || c.title,
    title: c.title,
    headline: c.headline,
    primaryText: c.primaryText,
    bodyText: c.bodyText,
    cta: c.cta || c.ctaText,
    imageUrl: c.imageUrl,
    platform: c.platform,
    status: c.status,
    source: c.source || "manual",
    createdAt: c.createdAt.toISOString(),
  }))

  // Normalise GeneratedCreative
  const normalisedGenerated = generated.map((g) => {
    const firstImage = Array.isArray(g.imageUrls) ? (g.imageUrls as any[])[0] : null
    return {
      id: g.id,
      name: `Generated · ${new Date(g.createdAt).toLocaleDateString()}`,
      title: "Ad creative",
      headline: Array.isArray(g.headlines) ? (g.headlines as any[]).find((h: any) => typeof h === "string") : null,
      primaryText: g.brief && typeof g.brief === "object" ? (g.brief as any).description || (g.brief as any).caption : null,
      bodyText: null,
      cta: null,
      imageUrl: typeof firstImage === "string" ? firstImage : null,
      platform: "GOOGLE",
      status: g.isPushed ? "launched" : "draft",
      source: "ai-generated",
      createdAt: g.createdAt.toISOString(),
    }
  })

  return NextResponse.json({
    ok: true,
    creatives: [...normalisedCreatives, ...normalisedGenerated].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      platform: c.platform,
      status: c.status,
      objective: c.objective,
      budgetDaily: c.budgetDaily,
      currency: c.currency,
      createdAt: c.createdAt.toISOString(),
    })),
    artifacts: artifacts
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 200),
  })
}
