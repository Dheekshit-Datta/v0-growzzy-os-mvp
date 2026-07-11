import { prisma } from "@/lib/prisma"
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
  const existing = await prisma.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true },
    orderBy: { workspace: { createdAt: "asc" } },
  })

  if (existing?.workspace) return existing.workspace

  const base = slugify(name || "Growzzy Workspace") || "growzzy-workspace"
  const slug = `${base}-${userId.slice(-6).toLowerCase()}`

  return prisma.workspace.create({
    data: {
      name: name || "Growzzy Workspace",
      slug,
      ownerId: userId,
      members: {
        create: {
          userId,
          role: "ADMIN",
        },
      },
    },
  })
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
  const requestedWorkspaceId = getRequestedWorkspaceIdFromRequest(request)

  const workspace = await assertWorkspaceMember(userId, requestedWorkspaceId)
  return workspace.id
}

function getRequestedWorkspaceIdFromRequest(request?: NextRequest | Request | null) {
  if (!request) return null

  // NextRequest path (preferred when available)
  const fromNextUrl = (request as NextRequest)?.nextUrl?.searchParams?.get?.("workspaceId")
  if (fromNextUrl) return fromNextUrl

  const fromNextCookie = (request as NextRequest)?.cookies?.get?.(ACTIVE_WORKSPACE_COOKIE)?.value
  if (fromNextCookie) return fromNextCookie

  // Standard Request fallback (many route handlers use `Request`, not `NextRequest`)
  try {
    const url = new URL(request.url)
    const fromUrl = url.searchParams.get("workspaceId")
    if (fromUrl) return fromUrl
  } catch {
    // Ignore invalid URL parsing and continue to cookie parsing fallback.
  }

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
