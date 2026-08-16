var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { isUnverifiedExternalId } from "@/lib/data-trust";
import { updateGoogleCampaignStatus } from "@/lib/platform-actions";
import { GoogleAdsService } from "@/services/integrations/google";
import { getIntegrationAccessToken } from "@/lib/integration-tokens";
import { MetaAdsService } from "@/services/integrations/meta";
import { currencyMinorAmount } from "@/lib/services/meta-publish";
function hoursSince(date) {
    if (!date)
        return Number.POSITIVE_INFINITY;
    return (Date.now() - date.getTime()) / (1000 * 60 * 60);
}
function normalizeGoogleStatus(status) {
    if (status === "ACTIVE")
        return "ENABLED";
    if (status === "REMOVED")
        return "REMOVED";
    if (status === "ENABLED")
        return "ENABLED";
    return "PAUSED";
}
function preflightError(message, remediation) {
    return new Error(`${message} Remediation: ${remediation}`);
}
export function assertCampaignMutationSafe(campaign, kind) {
    var _a, _b;
    if (!campaign.isLive || isUnverifiedExternalId(campaign.externalId)) {
        throw preflightError("Draft or unverified campaign. Platform mutation blocked.", "Sync campaigns and only run actions on verified live campaigns.");
    }
    if (!campaign.integration || !getIntegrationAccessToken(campaign.integration)) {
        throw preflightError("Platform token missing. Reconnect the ad account first.", "Reconnect integration in Ad Accounts and rerun sync.");
    }
    if (!((_a = campaign.integration) === null || _a === void 0 ? void 0 : _a.hasAdsAccess) || ((_b = campaign.integration) === null || _b === void 0 ? void 0 : _b.status) !== "ACTIVE") {
        throw preflightError("Integration is not active with ads access. Reconnect and sync first.", "Complete OAuth, choose the right ad account, then click Sync.");
    }
    const latestSync = campaign.integration.lastSyncedAt || campaign.integration.lastSyncAt;
    if (hoursSince(latestSync) > 24) {
        throw preflightError("Data is stale (>24h since last sync). Run sync before applying mutations.", "Run a fresh sync to validate ownership and latest status.");
    }
    if (campaign.platform !== "GOOGLE" && campaign.platform !== "META") {
        throw preflightError("This campaign platform is not supported for live mutations.", "Use a verified Google or Meta campaign.");
    }
}
export function mutateCampaignStatusOnPlatform(campaign, status) {
    return __awaiter(this, void 0, void 0, function* () {
        assertCampaignMutationSafe(campaign, status === "REMOVED" ? "REMOVE" : "STATUS");
        const integration = campaign.integration;
        if (!integration) {
            throw new Error("Campaign integration missing. Reconnect and sync first.");
        }
        const accessToken = getIntegrationAccessToken(integration);
        if (!accessToken)
            throw new Error("Platform access token missing. Reconnect the ad account first.");
        if (campaign.platform === "GOOGLE") {
            const customerId = campaign.adAccountExternalId || integration.selectedAdAccountId || integration.accountId;
            if (!customerId)
                throw new Error("Google customer ID missing for this campaign.");
            const adAccounts = integration.adAccounts || [];
            const primary = adAccounts.find((account) => account.isPrimary);
            const loginCustomerId = (primary === null || primary === void 0 ? void 0 : primary.managerCustomerId) || null;
            return updateGoogleCampaignStatus({
                accessToken,
                customerId,
                campaignId: campaign.externalId,
                status: normalizeGoogleStatus(status),
                loginCustomerId,
            });
        }
        if (campaign.platform === "META") {
            const metaStatus = status === "REMOVED" ? "ARCHIVED" : status === "ENABLED" ? "ACTIVE" : status;
            return MetaAdsService.updateCampaignStatus(accessToken, campaign.externalId, metaStatus);
        }
        throw new Error("Unsupported platform for status mutation.");
    });
}
export function mutateGoogleCampaignBudgetOnPlatform(campaign, nextBudgetAmount) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        assertCampaignMutationSafe(campaign, "BUDGET");
        const integration = campaign.integration;
        if (!integration) {
            throw new Error("Campaign integration missing. Reconnect and sync first.");
        }
        const accessToken = getIntegrationAccessToken(integration);
        if (!accessToken)
            throw new Error("Platform access token missing. Reconnect the ad account first.");
        if (!Number.isFinite(nextBudgetAmount) || nextBudgetAmount <= 0) {
            throw new Error("Budget amount must be a positive number.");
        }
        if (campaign.platform === "META") {
            const raw = (campaign.rawData || {});
            const adSetId = (_a = raw === null || raw === void 0 ? void 0 : raw.meta) === null || _a === void 0 ? void 0 : _a.adSetId;
            if (!adSetId)
                throw new Error("Meta ad set ID is missing; sync this campaign before changing its budget.");
            const account = (integration.adAccounts || []).find((item) => item.externalId === campaign.adAccountExternalId) || (integration.adAccounts || []).find((item) => item.isPrimary);
            return MetaAdsService.updateAdSetBudget(accessToken, String(adSetId), currencyMinorAmount(nextBudgetAmount, (account === null || account === void 0 ? void 0 : account.currencyCode) || "USD"));
        }
        if (campaign.platform !== "GOOGLE")
            throw new Error("Unsupported platform for budget mutation.");
        const customerId = campaign.adAccountExternalId || integration.selectedAdAccountId || integration.accountId;
        if (!customerId)
            throw new Error("Google customer ID missing for this campaign.");
        const adAccounts = integration.adAccounts || [];
        const primary = adAccounts.find((account) => account.isPrimary);
        const loginCustomerId = (primary === null || primary === void 0 ? void 0 : primary.managerCustomerId) || null;
        const raw = (campaign.rawData || {});
        const budgetResourceName = campaign.externalBudgetId ||
            ((_b = raw === null || raw === void 0 ? void 0 : raw.campaignBudget) === null || _b === void 0 ? void 0 : _b.resourceName) ||
            ((_c = raw === null || raw === void 0 ? void 0 : raw.campaignBudget) === null || _c === void 0 ? void 0 : _c.id);
        if (!budgetResourceName)
            throw new Error("Google campaign budget resource is missing.");
        return GoogleAdsService.updateCampaignBudget({
            accessToken,
            customerId,
            campaignBudgetResourceName: String(budgetResourceName),
            amountMicros: Math.round(nextBudgetAmount * 1000000),
            loginCustomerId,
        });
    });
}
