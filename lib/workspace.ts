import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import type { NextRequest } from "next/server"

export const ACTIVE_WORKSPACE_COOKIE = "growzzy_active_workspace_id"

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

export async function ensureDefaultWorkspace(userId: string, name?: string | null) {
  const base = slugify(name || "Growzzy Workspace") || "growzzy-workspace"
  const slug = `${base.slice(0, 20)}-${userId.toLowerCase()}`

  try {
    return await prisma.workspace.upsert({
      where: { defaultForOwnerId: userId },
      update: {},
      create: {
        name: name || "Growzzy Workspace",
        slug,
        ownerId: userId,
        defaultForOwnerId: userId,
        members: {
          create: {
            userId,
            role: "ADMIN",
          },
        },
      },
    })
  } catch (error) {
    // A concurrent first request may finish the same unique upsert first.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const workspace = await prisma.workspace.findUnique({ where: { defaultForOwnerId: userId } })
      if (workspace) return workspace
    }
    throw error
  }
}

export async function assertWorkspaceMember(userId: string, workspaceId?: string | null) {
  const workspace = workspaceId
    ? await prisma.workspace.findFirst({
        where: { id: workspaceId, members: { some: { userId } } },
      })
    : await ensureDefaultWorkspace(userId)

  if (!workspace) {
    throw Object.assign(new Error("Workspace not found or access denied"), { code: "WORKSPACE_FORBIDDEN" })
  }

  return workspace
}

export async function getPrimaryWorkspaceId(userId: string) {
  const workspace = await ensureDefaultWorkspace(userId)
  return workspace.id
}

export async function getRequestWorkspaceId(userId: string, request?: NextRequest | Request | null) {
  const explicitWorkspaceId = getWorkspaceIdFromUrl(request)
  const requestedWorkspaceId = explicitWorkspaceId || getWorkspaceIdFromCookie(request)

  try {
    const workspace = await assertWorkspaceMember(userId, requestedWorkspaceId)
    return workspace.id
  } catch (error) {
    if (explicitWorkspaceId) throw error
    return getPrimaryWorkspaceId(userId)
  }
}

function getWorkspaceIdFromUrl(request?: NextRequest | Request | null) {
  if (!request) return null

  const fromNextUrl = (request as NextRequest)?.nextUrl?.searchParams?.get?.("workspaceId")
  if (fromNextUrl) return fromNextUrl

  try {
    const url = new URL(request.url)
    return url.searchParams.get("workspaceId")
  } catch {
    return null
  }
}

function getWorkspaceIdFromCookie(request?: NextRequest | Request | null) {
  if (!request) return null

  const fromNextCookie = (request as NextRequest)?.cookies?.get?.(ACTIVE_WORKSPACE_COOKIE)?.value
  if (fromNextCookie) return fromNextCookie

  const cookieHeader = request.headers?.get?.("cookie") || ""
  if (!cookieHeader) return null
  const parts = cookieHeader.split(";")
  for (const rawPart of parts) {
    const part = rawPart.trim()
    if (!part.startsWith(`${ACTIVE_WORKSPACE_COOKIE}=`)) continue
    const value = decodeURIComponent(part.slice(ACTIVE_WORKSPACE_COOKIE.length + 1))
    if (value) return value
  }

  return null
}

export async function shouldIncludeLegacyWorkspaceRows(userId: string) {
  void userId
  return false
}

export function workspaceWhere(workspaceId: string, includeLegacyRows: boolean) {
  void includeLegacyRows
  return { workspaceId }
}
