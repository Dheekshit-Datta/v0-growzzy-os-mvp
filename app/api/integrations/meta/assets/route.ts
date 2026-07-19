import type { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { getIntegrationAccessToken } from "@/lib/integration-tokens"
import { prisma } from "@/lib/prisma"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { MetaAdsService } from "@/services/integrations/meta"

const SelectionSchema = z.object({
  pageId: z.string().min(1).optional(),
  instagramActorId: z.string().min(1).nullable().optional(),
  pixelId: z.string().min(1).nullable().optional(),
  appId: z.string().min(1).nullable().optional(),
})

function object(value: Prisma.JsonValue | null | undefined): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {}
}

async function context(req: NextRequest) {
  if (!MetaAdsService.isEnabled()) throw new Error("META_DISABLED")
  const session = await auth()
  if (!session?.user?.id) throw new Error("UNAUTHORIZED")
  const userId = await resolveUserId(session.user.id)
  const limit = await rateLimitPolicy(userId, "platformSync")
  if (!limit.allowed) return { limited: true as const, limit }
  const workspaceId = await getRequestWorkspaceId(userId, req)
  const integration = await prisma.integration.findFirst({ where: { userId, workspaceId, platform: "META" } })
  const accessToken = integration ? getIntegrationAccessToken(integration) : null
  const adAccountId = integration?.selectedAdAccountId || integration?.accountId
  if (!integration || !accessToken || !adAccountId) throw new Error("META_ACCOUNT_REQUIRED")
  const assets = await MetaAdsService.discoverAssets(accessToken, adAccountId)
  return { limited: false as const, integration, assets }
}

function failure(error: unknown) {
  const code = error instanceof Error ? error.message : "META_ASSETS_FAILED"
  const status = code === "UNAUTHORIZED" ? 401 : code === "META_DISABLED" ? 404 : code === "META_ACCOUNT_REQUIRED" ? 409 : 502
  const message = code === "META_DISABLED"
    ? "Meta Ads is not enabled yet."
    : code === "META_ACCOUNT_REQUIRED"
      ? "Connect Meta Ads and select an ad account first."
      : code === "UNAUTHORIZED" ? "Unauthorized" : "Could not load Meta assets."
  return NextResponse.json({ ok: false, error: { code, message } }, { status })
}

export async function GET(req: NextRequest) {
  try {
    const result = await context(req)
    if (result.limited) return rateLimitResponse(result.limit)
    return NextResponse.json({
      ok: true,
      data: { available: result.assets, selected: object(result.integration.accountInfo).metaAssets || null },
    })
  } catch (error) {
    return failure(error)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const selection = SelectionSchema.parse(await req.json())
    const result = await context(req)
    if (result.limited) return rateLimitResponse(result.limit)
    const { integration, assets } = result
    const page = selection.pageId ? assets.pages.find((item) => item.id === selection.pageId) : undefined
    const pixel = selection.pixelId ? assets.pixels.find((item) => item.id === selection.pixelId) : undefined
    const app = selection.appId ? assets.apps.find((item) => item.id === selection.appId) : undefined
    const instagram = selection.instagramActorId
      ? assets.pages.map((item) => item.instagramActor).find((item) => item?.id === selection.instagramActorId)
      : undefined
    if ((selection.pageId && !page) || (selection.pixelId && !pixel) || (selection.appId && !app) || (selection.instagramActorId && !instagram)) {
      return NextResponse.json({ ok: false, error: { code: "META_ASSET_NOT_OWNED", message: "One or more selected Meta assets are not available to this connection." } }, { status: 403 })
    }

    const accountInfo = object(integration.accountInfo)
    accountInfo.metaAssets = {
      ...(page ? { pageId: page.id, pageName: page.name } : {}),
      ...(instagram ? { instagramActorId: instagram.id, instagramActorName: instagram.name } : {}),
      ...(pixel ? { pixelId: pixel.id, pixelName: pixel.name } : {}),
      ...(app ? { appId: app.id, appName: app.name } : {}),
    }
    await prisma.integration.update({ where: { id: integration.id }, data: { accountInfo } })
    return NextResponse.json({ ok: true, data: { selected: accountInfo.metaAssets } })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: { code: "VALIDATION_FAILED", message: error.issues[0]?.message || "Invalid Meta assets" } }, { status: 400 })
    }
    return failure(error)
  }
}
