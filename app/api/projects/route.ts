import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"

export const dynamic = "force-dynamic"

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const workspaceId = await getRequestWorkspaceId(userId, req)

  const projects = await prisma.project.findMany({
    where: { userId, workspaceId },
    include: { _count: { select: { campaigns: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return NextResponse.json({
    ok: true,
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      campaignCount: p._count.campaigns,
      createdAt: p.createdAt,
    })),
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = await resolveUserId(session.user.id)
  const workspaceId = await getRequestWorkspaceId(userId, req)

  const parsed = CreateProjectSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid project" }, { status: 400 })
  }

  const project = await prisma.project.create({
    data: { userId, workspaceId, name: parsed.data.name.trim(), description: parsed.data.description?.trim() || null },
  })

  return NextResponse.json({ ok: true, project }, { status: 201 })
}
