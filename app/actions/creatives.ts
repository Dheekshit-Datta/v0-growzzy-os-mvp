"use server"

import { prisma } from "@/lib/prisma"

export async function listCreatives(userId?: string) {
  return prisma.creative.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { createdAt: "desc" },
  })
}

export const getCreatives = listCreatives

export async function createCreative(data: {
  userId: string
  name?: string
  title?: string
  primaryText?: string
  bodyText?: string
  headline?: string
  cta?: string
  imageUrl?: string
  platform?: string
  campaignId?: string
}) {
  return prisma.creative.create({
    data: {
      userId: data.userId,
      name: data.name || data.title || "Untitled creative",
      title: data.title || data.name || "Untitled creative",
      primaryText: data.primaryText || data.bodyText || "",
      bodyText: data.bodyText || data.primaryText || "",
      headline: data.headline,
      cta: data.cta,
      imageUrl: data.imageUrl,
      platform: data.platform || "GOOGLE",
      campaignId: data.campaignId,
    },
  })
}

export async function deleteCreative(id: string) {
  return prisma.creative.delete({ where: { id } })
}

export async function saveContent(data: { title: string; content: string; type?: string }) {
  const user = await prisma.user.findFirst({ select: { id: true } })
  if (!user) return { success: false, error: "No user found" }
  await createCreative({
    userId: user.id,
    title: data.title,
    primaryText: data.content,
    bodyText: data.content,
    platform: data.type || "CONTENT",
  })
  return { success: true }
}
