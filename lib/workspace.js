var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
export const ACTIVE_WORKSPACE_COOKIE = "growzzy_active_workspace_id";
function slugify(value) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
}
export function ensureDefaultWorkspace(userId, name) {
    return __awaiter(this, void 0, void 0, function* () {
        const base = slugify(name || "Growzzy Workspace") || "growzzy-workspace";
        const slug = `${base.slice(0, 20)}-${userId.toLowerCase()}`;
        try {
            return yield prisma.workspace.upsert({
                where: { defaultForOwnerId: userId },
                update: {},
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    ownerId: true,
                    websiteUrl: true,
                    productDescription: true,
                    industry: true,
                    toneOfVoice: true,
                    defaultLandingPageUrl: true,
                    logo: true,
                },
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
            });
        }
        catch (error) {
            // A concurrent first request may finish the same unique upsert first.
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                const workspace = yield prisma.workspace.findUnique({
                    where: { defaultForOwnerId: userId },
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        ownerId: true,
                        websiteUrl: true,
                        productDescription: true,
                        industry: true,
                        toneOfVoice: true,
                        defaultLandingPageUrl: true,
                        logo: true,
                    },
                });
                if (workspace)
                    return workspace;
            }
            throw error;
        }
    });
}
export function assertWorkspaceMember(userId, workspaceId) {
    return __awaiter(this, void 0, void 0, function* () {
        const workspace = workspaceId
            ? yield prisma.workspace.findFirst({
                where: { id: workspaceId, members: { some: { userId } } },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    ownerId: true,
                    websiteUrl: true,
                    productDescription: true,
                    industry: true,
                    toneOfVoice: true,
                    defaultLandingPageUrl: true,
                    logo: true,
                },
            })
            : yield ensureDefaultWorkspace(userId);
        if (!workspace) {
            throw Object.assign(new Error("Workspace not found or access denied"), { code: "WORKSPACE_FORBIDDEN" });
        }
        return workspace;
    });
}
export function getPrimaryWorkspaceId(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const workspace = yield ensureDefaultWorkspace(userId);
        return workspace.id;
    });
}
export function getRequestWorkspaceId(userId, request) {
    return __awaiter(this, void 0, void 0, function* () {
        const explicitWorkspaceId = getWorkspaceIdFromUrl(request);
        const requestedWorkspaceId = explicitWorkspaceId || getWorkspaceIdFromCookie(request);
        try {
            const workspace = yield assertWorkspaceMember(userId, requestedWorkspaceId);
            return workspace.id;
        }
        catch (error) {
            if (explicitWorkspaceId)
                throw error;
            return getPrimaryWorkspaceId(userId);
        }
    });
}
function getWorkspaceIdFromUrl(request) {
    var _a, _b, _c;
    if (!request)
        return null;
    const fromNextUrl = (_c = (_b = (_a = request === null || request === void 0 ? void 0 : request.nextUrl) === null || _a === void 0 ? void 0 : _a.searchParams) === null || _b === void 0 ? void 0 : _b.get) === null || _c === void 0 ? void 0 : _c.call(_b, "workspaceId");
    if (fromNextUrl)
        return fromNextUrl;
    try {
        const url = new URL(request.url);
        return url.searchParams.get("workspaceId");
    }
    catch (_d) {
        return null;
    }
}
function getWorkspaceIdFromCookie(request) {
    var _a, _b, _c, _d, _e;
    if (!request)
        return null;
    const fromNextCookie = (_c = (_b = (_a = request === null || request === void 0 ? void 0 : request.cookies) === null || _a === void 0 ? void 0 : _a.get) === null || _b === void 0 ? void 0 : _b.call(_a, ACTIVE_WORKSPACE_COOKIE)) === null || _c === void 0 ? void 0 : _c.value;
    if (fromNextCookie)
        return fromNextCookie;
    const cookieHeader = ((_e = (_d = request.headers) === null || _d === void 0 ? void 0 : _d.get) === null || _e === void 0 ? void 0 : _e.call(_d, "cookie")) || "";
    if (!cookieHeader)
        return null;
    const parts = cookieHeader.split(";");
    for (const rawPart of parts) {
        const part = rawPart.trim();
        if (!part.startsWith(`${ACTIVE_WORKSPACE_COOKIE}=`))
            continue;
        const value = decodeURIComponent(part.slice(ACTIVE_WORKSPACE_COOKIE.length + 1));
        if (value)
            return value;
    }
    return null;
}
export function shouldIncludeLegacyWorkspaceRows(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        void userId;
        return false;
    });
}
export function workspaceWhere(workspaceId, includeLegacyRows) {
    void includeLegacyRows;
    return { workspaceId };
}
