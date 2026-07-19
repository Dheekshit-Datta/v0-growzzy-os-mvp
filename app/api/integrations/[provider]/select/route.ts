import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { syncGoogleIntegration, syncMetaIntegration } from "@/lib/sync-engine"
import { MetaAdsService } from "@/services/integrations/meta"
import { getRequestWorkspaceId } from "@/lib/workspace"

export async function POST(req: Request, { params }: { params: { provider: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const userId = await resolveUserId(session.user.id)
    const workspaceId = await getRequestWorkspaceId(userId, req as any)
    const provider = params.provider.toLowerCase()
    if (!["google", "meta"].includes(provider)) {
      return NextResponse.json({ error: "Only Google Ads and Meta Ads accounts can be selected." }, { status: 400 })
    }

    const { accountId, accountName } = await req.json().catch(() => ({}))
    if (!accountId) return NextResponse.json({ error: "Account ID required" }, { status: 400 })

    const integration = await prisma.integration.findFirst({
      where: { userId, workspaceId, platform: provider.toUpperCase() as any },
    })

    if (!integration) return NextResponse.json({ error: "No connection found" }, { status: 404 })
    const ownedAccount = await prisma.adAccount.findFirst({
      where: { integrationId: integration.id, workspaceId, externalId: String(accountId) },
      select: { id: true, name: true },
    })
    if (!ownedAccount) return NextResponse.json({ error: "Selected account does not belong to this workspace connection" }, { status: 403 })

    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        selectedAdAccountId: accountId,
        selectedAdAccountName: ownedAccount.name || accountName || `Selected ${params.provider} account`,
        status: "ACCOUNT_SELECTED",
      },
    })

    const updated = await prisma.integration.findUnique({ where: { id: integration.id } })
    if (!updated) return NextResponse.json({ error: "Failed to update connection" }, { status: 500 })

    if (provider === "google") {
      await syncGoogleIntegration(updated)
    } else if (MetaAdsService.isEnabled()) {
      await syncMetaIntegration(updated)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to select account" }, { status: 500 })
  }
}
