import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/resolve-user";
import { getRequestWorkspaceId } from "@/lib/workspace";
import { invalidateBusinessContext } from "@/lib/business-context";
import { analyzeSite } from "@/lib/brand-analysis.server";

const AnalyzeSchema = z.object({ websiteUrl: z.string().optional(), url: z.string().optional() });

export async function POST(request: Request) {
  try {
    const body = AnalyzeSchema.parse(await request.json().catch(() => ({})));
    const url = body.websiteUrl || body.url || "";
    if (!url.trim()) return NextResponse.json({ ok: false, error: { message: "Add a website URL first." } }, { status: 400 });

    const apiKey = process.env.LOVABLE_API_KEY || process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY || "";
    if (!apiKey) return NextResponse.json({ ok: false, error: { message: "AI analysis is not configured." } }, { status: 503 });

    const { site, profile } = await analyzeSite(apiKey, url);
    const session = await auth().catch(() => null);
    if (session?.user?.id) {
      const userId = await resolveUserId(session.user.id);
      const workspaceId = await getRequestWorkspaceId(userId, request as never);
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          name: profile.businessName,
          websiteUrl: site,
          productDescription: profile.productDescription || null,
          industry: profile.industry || null,
          toneOfVoice: profile.tone || null,
          defaultLandingPageUrl: site,
        },
      });
      invalidateBusinessContext(workspaceId);
    }
    return NextResponse.json({ ok: true, site, profile });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: { message: error instanceof Error ? error.message : "Failed to analyse this website." } },
      { status: 500 },
    );
  }
}
