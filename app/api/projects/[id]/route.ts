import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { getRequestWorkspaceId } from "@/lib/workspace"

export const dynamic = "force-dynamic"

async function loadOwnedProject(req: NextRequest, id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const userId = await resolveUserId(session.user.id)
  const workspaceId = await getRequestWorkspaceId(userId, req)
  const project = await prisma.project.findFirst({ where: { id, userId, workspaceId } })
  if (!project) return { error: NextResponse.json({ error: "Project not found" }, { status: 404 }) }
  return { project, userId, workspaceId }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const result = await loadOwnedProject(req, params.id)
  if ("error" in result) return result.error

  const campaigns = await prisma.campaign.findMany({
    where: { projectId: result.project.id },
    select: { id: true, name: true, platform: true, status: true, spend: true, totalSpend: true, roas: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  })

  return NextResponse.json({ ok: true, project: result.project, campaigns })
}

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(300).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const result = await loadOwnedProject(req, params.id)
  if ("error" in result) return result.error

  const parsed = UpdateProjectSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid update" }, { status: 400 })

  const project = await prisma.project.update({
    where: { id: result.project.id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description.trim() || null } : {}),
    },
  })
  return NextResponse.json({ ok: true, project })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const result = await loadOwnedProject(req, params.id)
  if ("error" in result) return result.error

  // Unassign campaigns rather than touch them - deleting a project should
  // never delete or orphan-break a real campaign.
  await prisma.campaign.updateMany({ where: { projectId: result.project.id }, data: { projectId: null } })
  await prisma.project.delete({ where: { id: result.project.id } })
  return NextResponse.json({ ok: true })
}
