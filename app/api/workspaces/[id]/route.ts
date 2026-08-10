import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const UpdateWorkspaceSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  logo: z.string().url().optional().nullable(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId: params.id, userId: session.user.id, role: { in: ["ADMIN", "OWNER"] } },
  })
  if (!membership) return NextResponse.json({ error: "Workspace admin access required" }, { status: 403 })

  const parsed = UpdateWorkspaceSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const workspace = await prisma.workspace.update({
    where: { id: params.id },
    data: parsed.data,
    select: {
      id: true,
      name: true,
      logo: true,
    },
  })
  return NextResponse.json({ ok: true, workspace })
}
