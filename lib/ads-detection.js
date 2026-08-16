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
import { persistEncryptedGoogleTokenBinding } from "@/lib/google-token-store";
import { GoogleAdsApiError, GoogleAdsService } from "@/services/integrations/google";
import { MetaAdsService, MetaApiError } from "@/services/integrations/meta";
import { encryptedIntegrationTokens } from "@/lib/integration-tokens";
import { log } from "@/lib/logger";
export function detectGoogleAdsAccounts(accessToken) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
            return {
                hasAdsAccess: false,
                accounts: [],
                discoveryState: "API_ERROR",
                errorCode: "GOOGLE_ADS_DEVELOPER_TOKEN_MISSING",
                errorMessage: "Google Ads is authenticated, but account discovery is unavailable until GOOGLE_ADS_DEVELOPER_TOKEN is configured.",
            };
        }
        try {
            const discoveredAccounts = yield GoogleAdsService.discoverClientAccounts(accessToken);
            const usedAuthorizationFallback = discoveredAccounts.some((account) => account.discoveryFallback === "AUTHORIZATION");
            return {
                hasAdsAccess: discoveredAccounts.length > 0,
                accounts: discoveredAccounts,
                discoveryState: discoveredAccounts.length > 0 ? "HAS_ACCOUNTS" : "NO_ACCOUNTS",
                usedAuthorizationFallback,
            };
        }
        catch (error) {
            if (error instanceof GoogleAdsApiError) {
                log("warn", "google/detection", "Google Ads discovery failed", { message: error.message, code: error.errorCode });
                return {
                    hasAdsAccess: false,
                    accounts: [],
                    discoveryState: "API_ERROR",
                    errorCode: error.errorCode || "GOOGLE_ADS_API_ERROR",
                    errorMessage: error.message,
                };
            }
            log("error", "google/detection", "Unexpected Google Ads discovery failure", {
                message: error instanceof Error ? error.message : "Unknown error",
            });
            return {
                hasAdsAccess: false,
                accounts: [],
                discoveryState: "API_ERROR",
                errorCode: "GOOGLE_ADS_DISCOVERY_FAILED",
                errorMessage: error instanceof Error ? error.message : "Google Ads account discovery failed",
            };
        }
    });
}
export function refreshGoogleAccessToken(refreshToken) {
    return __awaiter(this, void 0, void 0, function* () {
        const refreshed = yield GoogleAdsService.refreshAccessToken(refreshToken);
        const accessToken = refreshed.access_token;
        const expiresIn = Number(refreshed.expires_in || 3600);
        if (!accessToken) {
            throw new Error("Google access token refresh returned no access token");
        }
        return {
            accessToken,
            expiresAt: new Date(Date.now() + expiresIn * 1000),
        };
    });
}
export function detectMetaAdsAccounts(accessToken) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const accounts = yield MetaAdsService.discoverAdAccounts(accessToken);
            return {
                hasAdsAccess: accounts.length > 0,
                accounts: accounts.map((account) => ({
                    externalId: account.externalId,
                    name: account.name,
                    currency: account.currency,
                    managerCustomerId: null,
                    isManager: false,
                    status: account.status,
                })),
                discoveryState: accounts.length > 0 ? "HAS_ACCOUNTS" : "NO_ACCOUNTS",
            };
        }
        catch (err) {
            if (err instanceof MetaApiError) {
                log("warn", "meta/detection", "Meta Ads discovery failed", { message: err.message });
                return {
                    hasAdsAccess: false,
                    accounts: [],
                    discoveryState: "API_ERROR",
                    errorCode: "META_ADS_API_ERROR",
                    errorMessage: err.message,
                };
            }
            log("error", "meta/detection", "Unexpected Meta Ads discovery failure", {
                message: err instanceof Error ? err.message : "Unknown error",
            });
            return {
                hasAdsAccess: false,
                accounts: [],
                discoveryState: "API_ERROR",
                errorCode: "META_ADS_DISCOVERY_FAILED",
                errorMessage: err instanceof Error ? err.message : "Meta Ads account discovery failed",
            };
        }
    });
}
export function persistIntegration(_a) {
    return __awaiter(this, arguments, void 0, function* ({ userId, workspaceId, platform, accessToken, refreshToken, expiresAt, hasAdsAccess, accounts, discoveryState, discoveryError, }) {
        var _b, _c, _d;
        const scopedWorkspaceId = workspaceId ||
            ((_b = (yield prisma.workspaceMember.findFirst({
                where: { userId },
                select: { workspaceId: true },
                orderBy: { workspace: { createdAt: "asc" } },
            }))) === null || _b === void 0 ? void 0 : _b.workspaceId);
        if (!scopedWorkspaceId) {
            throw new Error("A workspace is required before connecting an ad platform.");
        }
        const tokenData = encryptedIntegrationTokens(accessToken, refreshToken);
        const existingIntegration = yield prisma.integration.findFirst({
            where: { userId, workspaceId: scopedWorkspaceId, platform },
        });
        if (platform === "GOOGLE" && discoveryState === "API_ERROR") {
            if (existingIntegration) {
                const updatedIntegration = yield prisma.integration.update({
                    where: { id: existingIntegration.id },
                    data: Object.assign(Object.assign({ workspaceId: scopedWorkspaceId }, tokenData), { expiresAt, status: "RECONNECT_REQUIRED", validationError: discoveryError || "Google Ads account discovery failed", lastSyncError: discoveryError || existingIntegration.lastSyncError, updatedAt: new Date() }),
                });
                if (refreshToken) {
                    yield persistEncryptedGoogleTokenBinding({
                        integrationId: updatedIntegration.id,
                        refreshToken,
                        customerId: existingIntegration.selectedAdAccountId || null,
                    });
                }
                return updatedIntegration;
            }
            const createdIntegration = yield prisma.integration.create({
                data: Object.assign(Object.assign({ userId, workspaceId: scopedWorkspaceId, platform }, tokenData), { expiresAt, hasAdsAccount: false, status: "RECONNECT_REQUIRED", validationError: discoveryError || "Google Ads account discovery failed", lastSyncError: discoveryError || null }),
            });
            yield persistEncryptedGoogleTokenBinding({
                integrationId: createdIntegration.id,
                refreshToken,
                customerId: null,
            });
            return createdIntegration;
        }
        if (platform === "META" && discoveryState === "API_ERROR") {
            if (existingIntegration) {
                const updatedIntegration = yield prisma.integration.update({
                    where: { id: existingIntegration.id },
                    data: Object.assign(Object.assign({}, tokenData), { expiresAt, status: "RECONNECT_REQUIRED", validationError: discoveryError || "Meta Ads account discovery failed", lastSyncError: discoveryError || existingIntegration.lastSyncError, updatedAt: new Date() }),
                });
                return updatedIntegration;
            }
            const createdIntegration = yield prisma.integration.create({
                data: Object.assign(Object.assign({ userId, workspaceId: scopedWorkspaceId, platform }, tokenData), { expiresAt, hasAdsAccount: false, hasAdsAccess: false, status: "RECONNECT_REQUIRED", validationError: discoveryError || "Meta Ads account discovery failed", lastSyncError: discoveryError || null }),
            });
            return createdIntegration;
        }
        const integration = existingIntegration
            ? yield prisma.integration.update({
                where: { id: existingIntegration.id },
                data: Object.assign(Object.assign({ workspaceId: scopedWorkspaceId }, tokenData), { expiresAt, hasAdsAccount: hasAdsAccess, hasAdsAccess, status: hasAdsAccess ? "ACCOUNT_SELECTED" : "NO_AD_ACCOUNT", validationError: null, updatedAt: new Date() }),
            })
            : yield prisma.integration.create({
                data: Object.assign(Object.assign({ userId, workspaceId: scopedWorkspaceId, platform }, tokenData), { expiresAt, hasAdsAccount: hasAdsAccess, hasAdsAccess, status: hasAdsAccess ? "ACCOUNT_SELECTED" : "NO_AD_ACCOUNT", validationError: null }),
            });
        if (!hasAdsAccess || accounts.length === 0) {
            yield prisma.adAccount.deleteMany({ where: { integrationId: integration.id } });
            yield prisma.integration.update({
                where: { id: integration.id },
                data: {
                    selectedAdAccountId: null,
                    selectedAdAccountName: null,
                },
            });
            if (platform === "GOOGLE") {
                yield persistEncryptedGoogleTokenBinding({
                    integrationId: integration.id,
                    refreshToken,
                    customerId: null,
                });
            }
            return integration;
        }
        const incomingIds = accounts.map((account) => account.externalId);
        yield prisma.adAccount.deleteMany({
            where: {
                integrationId: integration.id,
                externalId: { notIn: incomingIds },
            },
        });
        for (const account of accounts) {
            yield prisma.adAccount.upsert({
                where: {
                    integrationId_externalId: {
                        integrationId: integration.id,
                        externalId: account.externalId,
                    },
                },
                create: {
                    integrationId: integration.id,
                    userId,
                    workspaceId: scopedWorkspaceId,
                    platform,
                    externalId: account.externalId,
                    name: account.name,
                    currencyCode: account.currency,
                    managerCustomerId: account.managerCustomerId || null,
                    isManager: (_c = account.isManager) !== null && _c !== void 0 ? _c : false,
                    isPrimary: false,
                },
                update: {
                    userId,
                    workspaceId: scopedWorkspaceId,
                    name: account.name,
                    currencyCode: account.currency,
                    managerCustomerId: account.managerCustomerId || null,
                    isManager: (_d = account.isManager) !== null && _d !== void 0 ? _d : false,
                },
            });
        }
        let selectedAccount = yield prisma.adAccount.findFirst({
            where: { integrationId: integration.id, isPrimary: true },
        });
        if (!selectedAccount) {
            selectedAccount = yield prisma.adAccount.findFirst({
                where: { integrationId: integration.id },
                orderBy: { createdAt: "asc" },
            });
            if (selectedAccount) {
                yield prisma.adAccount.update({
                    where: { id: selectedAccount.id },
                    data: { isPrimary: true },
                });
            }
        }
        if (selectedAccount) {
            yield prisma.integration.update({
                where: { id: integration.id },
                data: {
                    selectedAdAccountId: selectedAccount.externalId,
                    selectedAdAccountName: selectedAccount.name,
                },
            });
        }
        if (platform === "GOOGLE") {
            yield persistEncryptedGoogleTokenBinding({
                integrationId: integration.id,
                refreshToken,
                customerId: (selectedAccount === null || selectedAccount === void 0 ? void 0 : selectedAccount.externalId) || null,
            });
        }
        return integration;
    });
}
