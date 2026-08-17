import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ensureDefaultWorkspace, getRequestWorkspaceId } from "@/lib/workspace"
import { invalidateBusinessContext } from "@/lib/business-context"

export const dynamic = "force-dynamic"

const CreateWorkspaceSchema = z.object({
  name: z.string().min(2).max(80),
  logo: z.string().url().optional().or(z.literal("")),
})

const UpdateWorkspaceSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  primaryGoal: z.enum(["SALES", "LEADS", "TRAFFIC", "APP_INSTALLS"]).optional(),
  currencyCode: z.string().min(3).max(3).optional(),
  timezone: z.string().min(1).max(80).optional(),
  dailyBudgetCeiling: z.coerce.number().min(1).max(100000).optional(),
  productDescription: z.string().max(1000).optional(),
  brandResearch: z.record(z.any()).optional(),
  industry: z.string().max(80).optional(),
  toneOfVoice: z.string().max(40).optional(),
  defaultLandingPageUrl: z.string().url().optional().or(z.literal("")),
  logo: z.string().max(2000000).optional(),
  defaultAutomationMode: z.enum(["ALERT", "APPROVAL", "FULL"]).optional(),
})

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48)
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await ensureDefaultWorkspace(session.user.id, session.user.name)
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      role: true,
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          ownerId: true,
          websiteUrl: true,
          primaryGoal: true,
          currencyCode: true,
          timezone: true,
          productDescription: true,
          brandResearch: true,
          industry: true,
          toneOfVoice: true,
          defaultLandingPageUrl: true,
          dailyBudgetCeiling: true,
          defaultAutomationMode: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { members: true, adAccounts: true, campaigns: true } },
        },
      },
    },
    orderBy: { workspace: { createdAt: "asc" } },
    take: 100,
  })

  return NextResponse.json({
    ok: true,
    workspaces: memberships.map((membership) => ({
      ...membership.workspace,
      role: membership.role,
    })),
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = CreateWorkspaceSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const baseSlug = slugify(parsed.data.name) || "workspace"
  const workspace = await prisma.workspace.create({
    data: {
      name: parsed.data.name,
      slug: `${baseSlug}-${session.user.id.slice(-6).toLowerCase()}-${Date.now().toString(36)}`,
      logo: parsed.data.logo || null,
      ownerId: session.user.id,
      members: { create: { userId: session.user.id, role: "ADMIN" } },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      ownerId: true,
      websiteUrl: true,
    },
  })

  return NextResponse.json({ ok: true, workspace }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = UpdateWorkspaceSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const workspaceId = await getRequestWorkspaceId(session.user.id, req)
  const data = parsed.data

  const workspace = await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.websiteUrl !== undefined ? { websiteUrl: data.websiteUrl || null } : {}),
      ...(data.primaryGoal !== undefined ? { primaryGoal: data.primaryGoal } : {}),
      ...(data.currencyCode !== undefined ? { currencyCode: data.currencyCode.toUpperCase() } : {}),
      ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
      ...(data.dailyBudgetCeiling !== undefined ? { dailyBudgetCeiling: data.dailyBudgetCeiling } : {}),
      ...(data.productDescription !== undefined ? { productDescription: data.productDescription || null } : {}),
      ...(data.brandResearch !== undefined ? { brandResearch: data.brandResearch } : {}),
      ...(data.industry !== undefined ? { industry: data.industry || null } : {}),
      ...(data.toneOfVoice !== undefined ? { toneOfVoice: data.toneOfVoice || null } : {}),
      ...(data.defaultLandingPageUrl !== undefined ? { defaultLandingPageUrl: data.defaultLandingPageUrl || null } : {}),
      ...(data.logo !== undefined ? { logo: data.logo || null } : {}),
      ...(data.defaultAutomationMode !== undefined ? { defaultAutomationMode: data.defaultAutomationMode } : {}),
    },
    select: {
      id: true,
      name: true,
      websiteUrl: true,
      productDescription: true,
      brandResearch: true,
      industry: true,
      toneOfVoice: true,
      defaultLandingPageUrl: true,
      logo: true,
    },
  })

  invalidateBusinessContext(workspaceId)

  return NextResponse.json({ ok: true, workspace })
}
