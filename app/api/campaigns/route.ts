import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveUserId } from '@/lib/resolve-user'
import { log } from '@/lib/logger'
import { getRequestWorkspaceId } from '@/lib/workspace'
import { verifiedCampaignWhere } from '@/lib/data-trust'

export const dynamic = 'force-dynamic'

type SupportedPlatform = "GOOGLE"

function normalizeCampaignType(value: unknown) {
    return String(value || "SEARCH").trim().toUpperCase().replace(/[\s-]+/g, "_")
}

function parseBudget(value: unknown) {
    const budget = Number(value ?? 0)
    return Number.isFinite(budget) && budget > 0 ? budget : 0
}

function validateLaunchInput(input: { name?: string; platform?: string; budgetAmount?: unknown }) {
    const errors: string[] = []
    if (!input.name || input.name.trim().length < 3) errors.push("Campaign name must be at least 3 characters.")
    if (!input.platform) errors.push("Campaign platform is required.")
    if (input.budgetAmount !== undefined && parseBudget(input.budgetAmount) <= 0) errors.push("Budget must be greater than 0.")
    return errors
}

// ============================================
// GET — Fetch all campaigns for user
// ============================================
export async function GET(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 })
        }
        const userId = await resolveUserId(session.user.id)

        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')
        const platformName = searchParams.get('platform')?.toUpperCase()

        const workspaceId = await getRequestWorkspaceId(userId, request)
        const integrations = await prisma.integration.findMany({
            where: {
                userId,
                workspaceId,
                hasAdsAccess: true,
                status: "ACTIVE",
                ...(platformName ? { platform: platformName as any } : {}),
            },
            select: { id: true, selectedAdAccountId: true, accountId: true },
        })
        const selectedAdAccountIds = integrations.map((integration) => integration.selectedAdAccountId || integration.accountId).filter(Boolean) as string[]
        if (!integrations.length || !selectedAdAccountIds.length) {
            return NextResponse.json({ ok: true, data: { campaigns: [] } })
        }

        const where: any = {
            ...verifiedCampaignWhere({ userId, workspaceId }),
            integrationId: { in: integrations.map((integration) => integration.id) },
            adAccountId: { in: selectedAdAccountIds },
        }
        if (status) where.status = status
        if (platformName) where.platform = platformName

        const campaigns = await prisma.campaign.findMany({
            where,
            include: {
                integration: true,
                adGroups: {
                    include: {
                        _count: { select: { keywords: true, ads: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                },
                adSets: {
                    include: { _count: { select: { ads: true } } },
                    orderBy: { createdAt: 'desc' },
                },
                creatives: { select: { id: true, title: true } },
                workspace: { select: { id: true, name: true, slug: true } },
                _count: { select: { creatives: true, adGroups: true, adSets: true } },
            },
            orderBy: { createdAt: 'desc' },
        })

        return NextResponse.json({ ok: true, data: { campaigns } })
    } catch (error: any) {
        log('error', 'api/campaigns', 'Failed to fetch campaigns', { message: error?.message, stack: error?.stack })
        return NextResponse.json({ ok: false, error: { code: 'INTERNAL', message: 'Failed to fetch campaigns.' } }, { status: 500 })
    }
}

// ============================================
// POST — Create campaign
// ============================================
export async function POST(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 })
        }
        const userId = await resolveUserId(session.user.id)

        const body = await request.json()
        const {
            name,
            platform,
            objective,
            budgetAmount,
            goal,
            campaignType,
            type,
            networks,
            locations,
            languages,
            biddingStrategy,
            targetCpa,
            targetRoas,
            targetShare,
            budgetType,
            adSchedule,
            status,
            startDate,
            endDate,
            workspaceId: requestedWorkspaceId,
        } = body

        const validationErrors = validateLaunchInput({ name, platform, budgetAmount })
        if (validationErrors.length) {
            return NextResponse.json({ ok: false, error: { code: 'VALIDATION', message: validationErrors.join(" ") } }, { status: 400 })
        }

        const normalizedPlatform = String(platform).toUpperCase() as SupportedPlatform
        const normalizedType = normalizeCampaignType(campaignType || type || objective || "SEARCH")
        const parsedBudget = parseBudget(budgetAmount)
        const workspaceId = await getRequestWorkspaceId(userId, request)

        if (normalizedPlatform !== "GOOGLE") {
            return NextResponse.json({ ok: false, error: { code: "UNSUPPORTED_PLATFORM", message: "Only Google Ads campaign creation is supported in this pass." } }, { status: 400 })
        }

        const integration = await prisma.integration.findFirst({
            where: { userId, workspaceId, platform: normalizedPlatform },
            include: { adAccounts: { where: { isPrimary: true } } },
        })

        if (!integration || !integration.hasAdsAccess) {
            return NextResponse.json({
                ok: false,
                error: {
                    code: 'NOT_CONFIGURED',
                    message: `Connect ${normalizedPlatform} Ads and select an ad account before launching campaigns.`,
                },
            }, { status: 400 })
        }

        // Save to database strictly using the native DB model schema
        const primaryAccount = integration.adAccounts[0]
        const accountExternalId = primaryAccount?.externalId || integration.selectedAdAccountId || integration.accountId || null

        const campaign = await prisma.campaign.create({
            data: {
                integrationId: integration.id,
                workspaceId,
                userId,
                platform: normalizedPlatform,
                externalId: `local-${Date.now()}`, // Temporary local ID until real platform sync
                adAccountId: accountExternalId,
                name,
                objective: objective || goal || 'conversions',
                goal: goal || null,
                type: normalizedType,
                networks: networks || null,
                locations: locations || null,
                languages: languages || null,
                biddingStrategy: biddingStrategy || null,
                targetCpa: targetCpa ? Number(targetCpa) : null,
                targetRoas: targetRoas ? Number(targetRoas) : targetShare ? Number(targetShare) : null,
                budgetType: budgetType || "DAILY",
                adSchedule: adSchedule || null,
                status: (status || 'PAUSED').toUpperCase(),
                budgetAmount: parsedBudget || null,
                dailyBudget: parsedBudget || null,
                budgetCurrency: "USD",
                isLive: false,
                liveError: null,
                liveStatus: "DRAFT",
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
            },
            include: { integration: true },
        })

        return NextResponse.json({
            ok: true,
            data: { campaign },
            message: "Campaign draft saved. Publish through the reviewed hierarchy flow to create it in the ad platform.",
        }, { status: 201 })
    } catch (error: any) {
        log('error', 'api/campaigns', 'Failed to create campaign', { message: error?.message, stack: error?.stack })
        return NextResponse.json({ ok: false, error: { code: 'INTERNAL', message: 'Failed to create campaign.' } }, { status: 500 })
    }
}
