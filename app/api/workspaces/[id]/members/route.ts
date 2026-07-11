import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

export const dynamic = "force-dynamic"

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]).default("VIEWER"),
})

async function requireAdmin(userId: string, workspaceId: string) {
  return prisma.workspaceMember.findFirst({
    where: { workspaceId, userId, role: { in: ["ADMIN", "OWNER"] } },
    include: { workspace: true },
  })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const admin = await requireAdmin(session.user.id, params.id)
  if (!admin) return NextResponse.json({ error: "Workspace admin access required" }, { status: 403 })

  const parsed = InviteSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const invitedUser = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (invitedUser) {
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: params.id, userId: invitedUser.id } },
      update: { role: parsed.data.role },
      create: { workspaceId: params.id, userId: invitedUser.id, role: parsed.data.role },
    })
  }

  await sendEmail({
    to: parsed.data.email,
    subject: `You've been invited to ${admin.workspace.name} on GROWZZY OS`,
    html: `<p>You were invited to join <strong>${admin.workspace.name}</strong> as ${parsed.data.role}.</p><p>Sign in to GROWZZY OS to access the workspace.</p>`,
  }).catch(() => undefined)

  return NextResponse.json({ ok: true, invitedExistingUser: Boolean(invitedUser) })
}
