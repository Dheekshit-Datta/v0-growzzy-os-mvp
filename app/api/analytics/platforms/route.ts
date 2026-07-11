import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"
import { verifiedMetricCampaignWhere } from "@/lib/data-trust"
import { log } from "@/lib/logger"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const session = await auth()

        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = await resolveUserId(session.user.id!)
        const workspaceId = await getRequestWorkspaceId(userId, request)
        const integrations = await prisma.integration.findMany({
            where: { userId, workspaceId, status: "ACTIVE", hasAdsAccess: true },
            select: { id: true, selectedAdAccountId: true, accountId: true },
        })
        const integrationIds = integrations.map((item) => item.id)
        const accountIds = integrations.map((item) => item.selectedAdAccountId || item.accountId).filter(Boolean) as string[]

        const campaigns = await prisma.campaign.findMany({
            where: {
                ...verifiedMetricCampaignWhere({ userId, workspaceId }),
                integrationId: { in: integrationIds },
                adAccountId: { in: accountIds },
            }
        });

        // Aggregate by platform natively
        const platformMap: Record<string, { name: string, spend: number, revenue: number }> = {};

        for (const camp of campaigns) {
            const platformName = camp.platform.charAt(0).toUpperCase() + camp.platform.slice(1).toLowerCase() + " Ads";
            
            if (!platformMap[platformName]) {
                platformMap[platformName] = { name: platformName, spend: 0, revenue: 0 };
            }
            platformMap[platformName].spend += (camp.spend || 0);
            platformMap[platformName].revenue += (camp.revenue || 0);
        }

        const platformArray = Object.values(platformMap).map(p => ({
            ...p,
            roas: p.spend > 0 ? (p.revenue / p.spend) : 0,
            change: 0 // Optional trend change implementation
        }));

        return NextResponse.json({
            platforms: platformArray
        });

    } catch (error: any) {
        log("error", "api/analytics/platforms", "Failed to load platform analytics", { message: error?.message });
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
