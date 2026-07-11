import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUserId } from "@/lib/auth"
import { detectGoogleAdsAccounts, persistIntegration } from "@/lib/ads-detection"
import { getRequestWorkspaceId } from "@/lib/workspace"

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId()
    const workspaceId = await getRequestWorkspaceId(userId, req)
    const integration = await prisma.integration.findFirst({
      where: { userId, workspaceId, platform: "GOOGLE" },
      include: {
        adAccounts: true,
      },
    })

    if (!integration?.accessToken) {
      return NextResponse.json({ error: "Google integration not authorized" }, { status: 400 })
    }

    const detection = await detectGoogleAdsAccounts(integration.accessToken)

    await persistIntegration({
      userId,
      workspaceId,
      platform: "GOOGLE",
      accessToken: integration.accessToken,
      refreshToken: integration.refreshToken,
      expiresAt: integration.expiresAt,
      hasAdsAccess: detection.hasAdsAccess,
      accounts: detection.accounts,
      discoveryState: detection.discoveryState,
      discoveryError: detection.errorMessage || null,
    })

    if (detection.discoveryState === "API_ERROR") {
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          status: "RECONNECT_REQUIRED",
          validationError: detection.errorMessage || "Google Ads account discovery failed",
        },
      })

      return NextResponse.json({
        status: "RECONNECT_REQUIRED",
        errorCode: "GOOGLE_DISCOVERY_FAILED",
        message:
          detection.errorMessage ||
          "Google Ads account discovery failed. Reconnect and verify developer token/account permissions.",
      })
    }

    const refreshed = await prisma.integration.findUnique({
      where: { id: integration.id },
      include: { adAccounts: true },
    })

    if (!detection.hasAdsAccess || !refreshed || refreshed.adAccounts.length === 0) {
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          status: "NO_AD_ACCOUNT",
          selectedAdAccountId: null,
          selectedAdAccountName: null,
        },
      })

      return NextResponse.json({
        status: "NO_AD_ACCOUNT",
        accounts: [],
        message: "No active Google Ads accounts found. Please [Connect an Ad Account]",
      })
    }

    const accounts = refreshed.adAccounts
      .filter((account) => !account.isManager)
      .map((account) => ({
        externalId: account.externalId,
        name: account.name,
        managerCustomerId: account.managerCustomerId,
        isManager: account.isManager,
      }))

    if (accounts.length === 1) {
      await prisma.adAccount.updateMany({
        where: { integrationId: integration.id },
        data: { isPrimary: false },
      })

      await prisma.adAccount.updateMany({
        where: {
          integrationId: integration.id,
          externalId: accounts[0].externalId,
        },
        data: { isPrimary: true },
      })

      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          selectedAdAccountId: accounts[0].externalId,
          selectedAdAccountName: accounts[0].name,
          status: "ACCOUNT_SELECTED",
        },
      })

      return NextResponse.json({
        status: "ACCOUNT_SELECTED",
        accounts,
        autoSelected: true,
      })
    }

    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        status: "ACCOUNT_SELECTION_REQUIRED",
      },
    })

    return NextResponse.json({
      status: "ACCOUNT_SELECTION_REQUIRED",
      accounts,
      autoSelected: false,
    })
  } catch (error: any) {
    console.error("[Google Validate Error]", {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
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
