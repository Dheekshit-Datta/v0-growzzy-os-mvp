import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveUserId } from "@/lib/resolve-user"
import { rateLimitPolicy, rateLimitResponse } from "@/lib/rate-limit"
import { getRequestWorkspaceId } from "@/lib/workspace"

export const dynamic = "force-dynamic"

const MessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.any(),
}).passthrough()

const SaveSchema = z.object({
  messages: z.array(MessageSchema).max(200),
  title: z.string().max(120).optional(),
})

/** GET /api/ai/conversations/[id] — load a single conversation */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }
    const userId = await resolveUserId(session.user.id)
    const limit = await rateLimitPolicy(userId, "aiUtility")
    if (!limit.allowed) return rateLimitResponse(limit)
    const workspaceId = await getRequestWorkspaceId(userId, req)

    const conv = await prisma.conversation.findFirst({
      where: { id, userId, workspaceId },
      select: { id: true, title: true, messages: true, createdAt: true, updatedAt: true },
    })
    if (!conv) {
      return NextResponse.json({ ok: false, error: "Conversation not found" }, { status: 404 })
    }
    return NextResponse.json({ ok: true, conversation: conv })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to load conversation" }, { status: 500 })
  }
}

/** PUT /api/ai/conversations/[id] — save/update a conversation */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }
    const userId = await resolveUserId(session.user.id)
    const limit = await rateLimitPolicy(userId, "aiUtility")
    if (!limit.allowed) return rateLimitResponse(limit)
    const workspaceId = await getRequestWorkspaceId(userId, req)

    const body = await req.json().catch(() => ({}))
    const parsed = SaveSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Invalid payload" }, { status: 400 })
    }

    const title = parsed.data.title || (() => {
      const first = parsed.data.messages.find((m) => m.role === "user")
      const text = typeof first?.content === "string" ? first.content : ""
      return text.slice(0, 80).replace(/\n/g, " ") || "New Conversation"
    })()

    // Verify ownership before writing
    const existing = await prisma.conversation.findFirst({ where: { id, userId, workspaceId }, select: { id: true } })
    if (existing) {
      await prisma.conversation.update({
        where: { id },
        data: { messages: parsed.data.messages as any, title, updatedAt: new Date() },
      })
    } else {
      await prisma.conversation.create({
        data: {
          id,
          userId,
          workspaceId,
          title,
          messages: parsed.data.messages as any,
        },
      })
    }
    return NextResponse.json({ ok: true, id, title })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to save conversation" }, { status: 500 })
  }
}

/** DELETE /api/ai/conversations/[id] — remove a conversation */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }
    const userId = await resolveUserId(session.user.id)
    const limit = await rateLimitPolicy(userId, "aiUtility")
    if (!limit.allowed) return rateLimitResponse(limit)
    const workspaceId = await getRequestWorkspaceId(userId, req)

    const existing = await prisma.conversation.findFirst({ where: { id, userId, workspaceId }, select: { id: true } })
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Conversation not found" }, { status: 404 })
    }
    await prisma.conversation.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to delete conversation" }, { status: 500 })
  }
}
