var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createGoogleAdGroup, createGoogleAdsCampaign, createGoogleKeywords, createGoogleResponsiveSearchAd, updateGoogleCampaignStatus, } from "@/lib/platform-actions";
import { getIntegrationAccessToken } from "@/lib/integration-tokens";
import { recordActivity } from "@/lib/activity-log";
import { log } from "@/lib/logger";
import { ensureFreshGoogleToken } from "@/lib/sync-engine";
import { assessGoogleSearchPlan, GoogleSearchPlanSchema } from "@/lib/google-plan-quality";
export function validatePlanForLaunch(plan, fallbackFinalUrl) {
    var _a;
    const candidate = Object.assign(Object.assign({}, plan), { finalUrl: (plan === null || plan === void 0 ? void 0 : plan.finalUrl) || fallbackFinalUrl || undefined });
    const parsed = GoogleSearchPlanSchema.safeParse(candidate);
    if (!parsed.success)
        return { error: ((_a = parsed.error.issues[0]) === null || _a === void 0 ? void 0 : _a.message) || "Campaign plan is invalid" };
    const quality = assessGoogleSearchPlan(parsed.data, { requireFinalUrl: true });
    if (quality.status === "FAIL")
        return { error: quality.errors[0] };
    const campaignName = String((plan === null || plan === void 0 ? void 0 : plan.campaignName) || "").trim();
    if (!campaignName)
        return { error: "Plan is missing a campaign name" };
    const dailyBudget = Number(plan === null || plan === void 0 ? void 0 : plan.dailyBudget);
    if (!Number.isFinite(dailyBudget) || dailyBudget <= 0)
        return { error: "Plan is missing a valid daily budget" };
    const biddingStrategy = ["MAXIMIZE_CONVERSIONS", "MAXIMIZE_CLICKS", "TARGET_CPA", "TARGET_ROAS"].includes(String(plan === null || plan === void 0 ? void 0 : plan.biddingStrategy))
        ? String(plan.biddingStrategy)
        : "MAXIMIZE_CONVERSIONS";
    const targetCpa = biddingStrategy === "TARGET_CPA" ? Number(plan === null || plan === void 0 ? void 0 : plan.targetCpa) || null : null;
    if (biddingStrategy === "TARGET_CPA" && !targetCpa)
        return { error: "TARGET_CPA bidding requires a target CPA value" };
    // Target ROAS is expressed to Google Ads as a ratio (e.g. 4 = 400% / $4 revenue per $1 spend),
    // not a currency amount - reject anything that looks like a currency value entered by mistake.
    const targetRoas = biddingStrategy === "TARGET_ROAS" ? Number(plan === null || plan === void 0 ? void 0 : plan.targetRoas) || null : null;
    if (biddingStrategy === "TARGET_ROAS" && !targetRoas)
        return { error: "TARGET_ROAS bidding requires a target ROAS value" };
    if (targetRoas != null && (targetRoas < 0.1 || targetRoas > 50)) {
        return { error: "Target ROAS should be a ratio like 4 (meaning 4x / 400%), not a currency amount" };
    }
    const planFinalUrl = String((plan === null || plan === void 0 ? void 0 : plan.finalUrl) || fallbackFinalUrl || "").trim();
    const rawGroups = Array.isArray(plan === null || plan === void 0 ? void 0 : plan.adGroups) ? plan.adGroups : [];
    if (rawGroups.length === 0)
        return { error: "Plan has no ad groups" };
    const adGroups = [];
    for (const group of rawGroups) {
        const name = String((group === null || group === void 0 ? void 0 : group.name) || "").trim();
        if (!name)
            return { error: "An ad group is missing a name" };
        const finalUrl = String((group === null || group === void 0 ? void 0 : group.finalUrl) || planFinalUrl).trim();
        if (!/^https?:\/\//.test(finalUrl))
            return { error: `Ad group "${name}" has no final URL — add your landing page URL` };
        const keywords = (Array.isArray(group === null || group === void 0 ? void 0 : group.keywords) ? group.keywords : [])
            .map((k) => ({
            text: String((k === null || k === void 0 ? void 0 : k.text) || k || "").trim().slice(0, 80),
            matchType: (["BROAD", "PHRASE", "EXACT"].includes(String(k === null || k === void 0 ? void 0 : k.matchType)) ? String(k.matchType) : "PHRASE"),
        }))
            .filter((k) => k.text);
        if (keywords.length === 0)
            return { error: `Ad group "${name}" has no keywords` };
        const negativeKeywords = (Array.isArray(group === null || group === void 0 ? void 0 : group.negativeKeywords) ? group.negativeKeywords : [])
            .map((k) => String((k === null || k === void 0 ? void 0 : k.text) || k || "").trim().slice(0, 80))
            .filter(Boolean);
        const headlines = (Array.isArray(group === null || group === void 0 ? void 0 : group.headlines) ? group.headlines : [])
            .map((h) => String((h === null || h === void 0 ? void 0 : h.text) || h || "").trim().slice(0, 30))
            .filter(Boolean);
        if (headlines.length < 3)
            return { error: `Ad group "${name}" needs at least 3 headlines (30 chars max each)` };
        const descriptions = (Array.isArray(group === null || group === void 0 ? void 0 : group.descriptions) ? group.descriptions : [])
            .map((d) => String((d === null || d === void 0 ? void 0 : d.text) || d || "").trim().slice(0, 90))
            .filter(Boolean);
        if (descriptions.length < 2)
            return { error: `Ad group "${name}" needs at least 2 descriptions (90 chars max each)` };
        adGroups.push({ name, theme: String((group === null || group === void 0 ? void 0 : group.theme) || ""), keywords, negativeKeywords, headlines, descriptions, finalUrl });
    }
    return { plan: { campaignName, dailyBudget, biddingStrategy, targetCpa, targetRoas, adGroups } };
}
export function planFingerprint(planRowId, plan) {
    return crypto.createHash("sha256").update(planRowId + JSON.stringify(plan)).digest("hex").slice(0, 40);
}
export function launchPlanToGoogle(params) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const { planRowId, userId, workspaceId } = params;
        const planRow = yield prisma.campaignPlan.findFirst({
            where: { id: planRowId, userId, workspaceId },
            include: { adAccount: { select: { managerCustomerId: true } } },
        });
        if (!planRow)
            return { ok: false, error: "Campaign plan not found", code: "NOT_FOUND" };
        if (planRow.status === "LIVE") {
            return { ok: false, error: "This plan has already been launched", code: "ALREADY_LIVE" };
        }
        if (planRow.status === "PUBLISHING") {
            return { ok: false, error: "This plan is already publishing — wait for it to finish", code: "PUBLISH_IN_PROGRESS" };
        }
        const validated = validatePlanForLaunch(planRow.plan);
        if (validated.error || !validated.plan)
            return { ok: false, error: validated.error, code: "VALIDATION_FAILED" };
        const plan = validated.plan;
        // Idempotency: same plan content already published → return existing result
        const fingerprint = planFingerprint(planRow.id, plan);
        if (planRow.publishFingerprint === fingerprint && planRow.externalCampaignId) {
            return {
                ok: true,
                campaignId: planRow.launchedCampaignId || undefined,
                externalCampaignId: planRow.externalCampaignId,
                adGroupsPublished: plan.adGroups.length,
            };
        }
        // Hard policy block
        const policyCheck = (_a = planRow.plan) === null || _a === void 0 ? void 0 : _a.policyCheck;
        if (!(policyCheck === null || policyCheck === void 0 ? void 0 : policyCheck.checkedAt)) {
            return { ok: false, error: "Run the policy check before launching", code: "POLICY_REQUIRED" };
        }
        if ((policyCheck === null || policyCheck === void 0 ? void 0 : policyCheck.status) === "FAIL") {
            return { ok: false, error: "This plan contains prohibited content and cannot be launched", code: "POLICY_BLOCK" };
        }
        if ((policyCheck === null || policyCheck === void 0 ? void 0 : policyCheck.status) === "WARN" && !((_b = planRow.plan) === null || _b === void 0 ? void 0 : _b.policyAcknowledged)) {
            return { ok: false, error: "Review and acknowledge the policy warnings before launching", code: "POLICY_ACK_REQUIRED" };
        }
        // Workspace budget ceiling — enforced server-side, never UI-only
        const workspace = yield prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { dailyBudgetCeiling: true },
        });
        if ((workspace === null || workspace === void 0 ? void 0 : workspace.dailyBudgetCeiling) != null) {
            const activeBudget = yield prisma.campaign.aggregate({
                where: { workspaceId, isLive: true },
                _sum: { budgetAmount: true },
            });
            if (Number(activeBudget._sum.budgetAmount || 0) + plan.dailyBudget > workspace.dailyBudgetCeiling) {
                return {
                    ok: false,
                    error: `Launching this would exceed your workspace daily budget ceiling of $${workspace.dailyBudgetCeiling}`,
                    code: "BUDGET_CEILING",
                };
            }
        }
        const integration = yield prisma.integration.findFirst({
            where: {
                userId,
                workspaceId,
                platform: "GOOGLE",
                status: { in: ["OAUTH_GRANTED", "ACCOUNT_SELECTED", "INITIAL_SYNC_RUNNING", "ACTIVE", "SYNC_FAILED"] },
                hasAdsAccess: true,
            },
        });
        const storedAccessToken = integration ? getIntegrationAccessToken(integration) : null;
        if (!integration || !storedAccessToken) {
            return { ok: false, error: "Reconnect Google Ads before launching", code: "AUTH_REQUIRED" };
        }
        const accessToken = yield ensureFreshGoogleToken(integration.id, storedAccessToken);
        const customerId = planRow.adAccountExternalId || integration.selectedAdAccountId || integration.accountId || "";
        if (!customerId)
            return { ok: false, error: "No Google Ads account selected", code: "PREFLIGHT_BLOCK" };
        const loginCustomerId = ((_c = planRow.adAccount) === null || _c === void 0 ? void 0 : _c.managerCustomerId) || null;
        yield prisma.campaignPlan.update({ where: { id: planRow.id }, data: { status: "PUBLISHING" } });
        let externalCampaignId = null;
        let localCampaignId = null;
        try {
            const campaignResult = yield createGoogleAdsCampaign({
                accessToken,
                customerId,
                name: plan.campaignName,
                dailyBudgetMicros: Math.round(plan.dailyBudget * 1000000),
                objective: "SEARCH",
                biddingStrategy: plan.biddingStrategy,
                targetCpaMicros: plan.targetCpa ? Math.round(plan.targetCpa * 1000000) : null,
                targetRoas: plan.targetRoas,
                status: "PAUSED",
                loginCustomerId,
            });
            externalCampaignId = campaignResult.campaignId;
            const localCampaign = yield prisma.campaign.create({
                data: {
                    workspaceId,
                    integrationId: integration.id,
                    userId,
                    platform: "GOOGLE",
                    externalId: campaignResult.campaignId,
                    adAccountId: planRow.adAccountId,
                    adAccountExternalId: customerId,
                    name: plan.campaignName,
                    status: "PAUSED",
                    objective: "SEARCH",
                    type: "SEARCH",
                    biddingStrategy: plan.biddingStrategy,
                    targetCpa: plan.targetCpa,
                    targetRoas: plan.targetRoas,
                    budgetAmount: plan.dailyBudget,
                    dailyBudget: plan.dailyBudget,
                    externalBudgetId: campaignResult.budgetResourceName || null,
                    isLive: true,
                    liveStatus: "LIVE_PAUSED",
                    verifiedAt: new Date(),
                    syncedAt: new Date(),
                    hasCreative: true,
                    rawData: { source: "AI_PLAN_LAUNCH", campaignPlanId: planRow.id },
                },
            });
            localCampaignId = localCampaign.id;
            for (const group of plan.adGroups) {
                const adGroupResult = yield createGoogleAdGroup({
                    accessToken,
                    customerId,
                    campaignId: campaignResult.campaignId,
                    name: group.name,
                    defaultBidMicros: null,
                    loginCustomerId,
                });
                const keywordPayload = [
                    ...group.keywords.map((k) => ({ text: k.text, matchType: k.matchType, isNegative: false })),
                    ...group.negativeKeywords.map((text) => ({ text, matchType: "BROAD", isNegative: true })),
                ];
                yield createGoogleKeywords({
                    accessToken,
                    customerId,
                    adGroupId: adGroupResult.resourceName || adGroupResult.adGroupId,
                    keywords: keywordPayload,
                    loginCustomerId,
                });
                const adResult = yield createGoogleResponsiveSearchAd({
                    accessToken,
                    customerId,
                    adGroupId: adGroupResult.resourceName || adGroupResult.adGroupId,
                    headlines: group.headlines.map((text) => ({ text })),
                    descriptions: group.descriptions.map((text) => ({ text })),
                    finalUrl: group.finalUrl,
                    displayPath1: null,
                    displayPath2: null,
                    loginCustomerId,
                });
                const localAdGroup = yield prisma.adGroup.create({
                    data: {
                        userId,
                        campaignId: localCampaign.id,
                        externalId: adGroupResult.adGroupId,
                        name: group.name,
                        theme: group.theme || null,
                        isLive: true,
                    },
                });
                yield prisma.keyword.createMany({
                    data: keywordPayload.map((k) => ({
                        userId,
                        adGroupId: localAdGroup.id,
                        text: k.text,
                        matchType: k.matchType,
                        isNegative: k.isNegative,
                    })),
                });
                yield prisma.ad.create({
                    data: {
                        userId,
                        adGroupId: localAdGroup.id,
                        externalId: adResult.adId,
                        resourceName: adResult.resourceName,
                        headlines: group.headlines.map((text) => ({ text })),
                        descriptions: group.descriptions.map((text) => ({ text })),
                        finalUrl: group.finalUrl,
                        adStrength: group.headlines.length >= 8 && group.descriptions.length >= 3 ? "GOOD" : "AVERAGE",
                        isLive: true,
                    },
                });
            }
            yield prisma.campaignPlan.update({
                where: { id: planRow.id },
                data: {
                    status: "LIVE",
                    launchedCampaignId: localCampaign.id,
                    externalCampaignId: campaignResult.campaignId,
                    publishFingerprint: fingerprint,
                    publishedAt: new Date(),
                },
            });
            yield recordActivity({
                userId,
                workspaceId,
                adAccountId: planRow.adAccountId || customerId,
                type: "AI_PLAN_LAUNCHED",
                title: `${plan.campaignName} launched paused from AI plan`,
                entityType: "Campaign",
                entityId: localCampaign.id,
                metadata: { campaignPlanId: planRow.id, externalCampaignId: campaignResult.campaignId, adGroups: plan.adGroups.length },
            });
            return {
                ok: true,
                campaignId: localCampaign.id,
                externalCampaignId: campaignResult.campaignId,
                adGroupsPublished: plan.adGroups.length,
            };
        }
        catch (error) {
            const message = (error === null || error === void 0 ? void 0 : error.message) || "Google Ads launch failed";
            log("error", "services/google-publish", "Plan launch failed", { planRowId, message });
            // Roll back the remote campaign so no orphaned spend surface exists
            if (externalCampaignId) {
                try {
                    yield updateGoogleCampaignStatus({
                        accessToken,
                        customerId,
                        campaignId: externalCampaignId,
                        status: "REMOVED",
                        loginCustomerId,
                    });
                }
                catch (rollbackError) {
                    log("error", "services/google-publish", "Rollback failed — manual cleanup needed", {
                        externalCampaignId,
                        message: rollbackError === null || rollbackError === void 0 ? void 0 : rollbackError.message,
                    });
                }
            }
            if (localCampaignId) {
                yield prisma.campaign.delete({ where: { id: localCampaignId } }).catch(() => undefined);
            }
            yield prisma.campaignPlan.update({
                where: { id: planRow.id },
                data: { status: "FAILED", plan: Object.assign(Object.assign({}, planRow.plan), { lastLaunchError: message }) },
            }).catch(() => undefined);
            return { ok: false, error: message, code: "PROVIDER_ERROR" };
        }
    });
}
