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
function normalizeAccountId(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/^act_/, "")
        .replace(/[-\s]/g, "");
}
export function getActiveAdAccountScope(userId, workspaceId, requestedAdAccountId) {
    return __awaiter(this, void 0, void 0, function* () {
        const integrations = yield prisma.integration.findMany({
            where: {
                userId,
                workspaceId,
                status: { in: ["ACTIVE", "ACCOUNT_SELECTED", "INITIAL_SYNC_RUNNING", "SYNC_FAILED"] },
            },
            select: {
                id: true,
                platform: true,
                status: true,
                hasAdsAccess: true,
                selectedAdAccountId: true,
                selectedAdAccountName: true,
                accountId: true,
                accountName: true,
                lastSyncedAt: true,
                lastSyncAt: true,
                adAccounts: {
                    where: { workspaceId },
                    select: {
                        externalId: true,
                        name: true,
                        isPrimary: true,
                        lastSyncedAt: true,
                    },
                    orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
                },
            },
            orderBy: [{ platform: "asc" }, { updatedAt: "desc" }],
        });
        const candidates = integrations
            .map((integration) => {
            const mappedAccount = integration.adAccounts.find((account) => account.externalId === integration.selectedAdAccountId) ||
                integration.adAccounts.find((account) => account.isPrimary) ||
                null;
            const selectedAdAccountId = (mappedAccount === null || mappedAccount === void 0 ? void 0 : mappedAccount.externalId) || integration.selectedAdAccountId || integration.accountId;
            if (!selectedAdAccountId || !integration.hasAdsAccess)
                return null;
            if (integration.platform !== "GOOGLE" && integration.platform !== "META")
                return null;
            return {
                integrationId: integration.id,
                platform: integration.platform,
                adAccountId: selectedAdAccountId,
                adAccountName: (mappedAccount === null || mappedAccount === void 0 ? void 0 : mappedAccount.name) || integration.selectedAdAccountName || integration.accountName || null,
                hasAdsAccess: Boolean(integration.hasAdsAccess),
                status: String(integration.status),
                lastSyncedAt: integration.lastSyncedAt || integration.lastSyncAt || (mappedAccount === null || mappedAccount === void 0 ? void 0 : mappedAccount.lastSyncedAt) || null,
            };
        })
            .filter(Boolean);
        if (requestedAdAccountId) {
            const requestedNormalized = normalizeAccountId(requestedAdAccountId);
            return (candidates.find((candidate) => normalizeAccountId(candidate.adAccountId) === requestedNormalized) ||
                null);
        }
        return candidates.find((candidate) => candidate.platform === "GOOGLE") || candidates[0] || null;
    });
}
export function requireActiveAdAccountScope(userId, workspaceId, requestedAdAccountId) {
    return __awaiter(this, void 0, void 0, function* () {
        const scope = yield getActiveAdAccountScope(userId, workspaceId, requestedAdAccountId);
        if (!scope) {
            throw Object.assign(new Error("Connect and select an ad account first."), { code: "NO_SELECTED_AD_ACCOUNT" });
        }
        return scope;
    });
}
