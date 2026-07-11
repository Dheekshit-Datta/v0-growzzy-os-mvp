import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ensureDefaultWorkspace } from "@/lib/workspace"

export const dynamic = "force-dynamic"

const CreateWorkspaceSchema = z.object({
  name: z.string().min(2).max(80),
  logo: z.string().url().optional().or(z.literal("")),
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
    include: {
      workspace: {
        include: {
          _count: { select: { members: true, adAccounts: true, campaigns: true } },
        },
      },
    },
    orderBy: { workspace: { createdAt: "asc" } },
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
  })

  return NextResponse.json({ ok: true, workspace }, { status: 201 })
}
