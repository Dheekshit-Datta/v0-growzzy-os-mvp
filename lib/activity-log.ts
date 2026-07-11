import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { log } from "@/lib/logger"

export async function recordActivity(input: {
  userId: string
  workspaceId?: string | null
  adAccountId?: string | null
  type: string
  title: string
  message?: string | null
  entityType?: string | null
  entityId?: string | null
  metadata?: Record<string, unknown> | null
}) {
  try {
    await prisma.activityLog.create({
      data: {
        userId: input.userId,
        workspaceId: input.workspaceId || null,
        adAccountId: input.adAccountId || null,
        type: input.type,
        title: input.title,
        message: input.message || null,
        entityType: input.entityType || null,
        entityId: input.entityId || null,
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
      },
    })
  } catch (error: any) {
    log("warn", "activity-log", "Failed to record activity", {
      message: error?.message,
      type: input.type,
      entityType: input.entityType,
    })
  }
}
