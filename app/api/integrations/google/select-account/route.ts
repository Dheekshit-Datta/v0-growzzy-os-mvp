import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/auth"
import { persistEncryptedGoogleTokenBinding } from "@/lib/google-token-store"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { getIntegrationRefreshToken } from "@/lib/integration-tokens"
import { log } from "@/lib/logger"

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId()
    const workspaceId = await getRequestWorkspaceId(userId, req)
    const { externalId } = await req.json()

    const integration = await prisma.integration.findFirst({
      where: {
        userId,
        workspaceId,
        platform: "GOOGLE",
      },
      include: {
        adAccounts: {
          select: {
            id: true,
            externalId: true,
            name: true,
            managerCustomerId: true,
            isManager: true,
          },
        },
      },
    })

    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 })
    }

    const selected = integration.adAccounts.find((account) => account.externalId === externalId)
    if (!selected) {
      return NextResponse.json({ error: "Invalid account selection" }, { status: 400 })
    }

    await prisma.$transaction([
      prisma.adAccount.updateMany({
        where: { integrationId: integration.id },
        data: { isPrimary: false },
      }),
      prisma.adAccount.update({
        where: { id: selected.id },
        data: { isPrimary: true },
      }),
      prisma.integration.update({
        where: { id: integration.id },
        data: {
          selectedAdAccountId: selected.externalId,
          selectedAdAccountName: selected.name,
          status: "ACCOUNT_SELECTED",
        },
      }),
    ])

    await persistEncryptedGoogleTokenBinding({
      integrationId: integration.id,
      refreshToken: getIntegrationRefreshToken(integration),
      customerId: selected.externalId,
    })

    return NextResponse.json({
      status: "ACCOUNT_SELECTED",
      selected: {
        externalId: selected.externalId,
        name: selected.name,
        managerCustomerId: selected.managerCustomerId,
        isManager: selected.isManager,
      },
    })
  } catch (error: any) {
    log("error", "google/select-account", "Google account selection failed", {
      message: error?.message,
      code: error?.code,
    })

    const isLikelyMigrationIssue =
      typeof error?.message === "string" &&
      (error.message.includes("managerCustomerId") ||
        error.message.includes("isManager") ||
        error.message.toLowerCase().includes("column") ||
        error.message.toLowerCase().includes("does not exist"))

    return NextResponse.json(
      {
        error: isLikelyMigrationIssue
          ? "Database schema is out of date. Run migrations (prisma migrate deploy) and retry."
          : error.message || "Unexpected error",
      },
      { status: 500 }
    )
  }
}
