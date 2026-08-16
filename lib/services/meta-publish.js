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
import { getIntegrationAccessToken } from "@/lib/integration-tokens";
import { recordActivity } from "@/lib/activity-log";
import { log } from "@/lib/logger";
import { MetaAdsService } from "@/services/integrations/meta";
const OBJECTIVES = ["OUTCOME_AWARENESS", "OUTCOME_TRAFFIC", "OUTCOME_ENGAGEMENT", "OUTCOME_LEADS", "OUTCOME_SALES", "OUTCOME_APP_PROMOTION"];
function object(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
export function currencyMinorAmount(amount, currencyCode = "USD") {
    var _a;
    const digits = (_a = new Intl.NumberFormat("en", { style: "currency", currency: currencyCode }).resolvedOptions().maximumFractionDigits) !== null && _a !== void 0 ? _a : 2;
    return Math.round(amount * Math.pow(10, digits));
}
export function validateMetaPlanForLaunch(raw) {
    var _a, _b;
    const campaignName = String((raw === null || raw === void 0 ? void 0 : raw.campaignName) || "").trim();
    if (!campaignName)
        return { error: "Plan is missing a campaign name" };
    const objective = String((raw === null || raw === void 0 ? void 0 : raw.objective) || "");
    if (!OBJECTIVES.includes(objective))
        return { error: "Plan has an unsupported Meta objective" };
    const dailyBudget = Number(raw === null || raw === void 0 ? void 0 : raw.dailyBudget);
    if (!Number.isFinite(dailyBudget) || dailyBudget <= 0)
        return { error: "Plan is missing a valid daily budget" };
    const pageId = String((raw === null || raw === void 0 ? void 0 : raw.pageId) || "").trim();
    if (!pageId)
        return { error: "Select a Facebook Page before launching" };
    const creative = object(raw === null || raw === void 0 ? void 0 : raw.creative);
    const imageUrl = String(creative.imageUrl || "").trim();
    if (!/^https:\/\//i.test(imageUrl))
        return { error: "Add a public HTTPS image before launching" };
    const destinationUrl = String(creative.destinationUrl || "").trim();
    if (!/^https:\/\//i.test(destinationUrl))
        return { error: "Add a public HTTPS destination URL before launching" };
    const pixelId = String((raw === null || raw === void 0 ? void 0 : raw.pixelId) || "").trim() || null;
    if (["OUTCOME_LEADS", "OUTCOME_SALES"].includes(objective) && !pixelId) {
        return { error: `${objective === "OUTCOME_LEADS" ? "Website leads" : "Sales"} requires a selected Meta Pixel/Dataset` };
    }
    const appId = String((raw === null || raw === void 0 ? void 0 : raw.appId) || "").trim() || null;
    const objectStoreUrl = String((raw === null || raw === void 0 ? void 0 : raw.objectStoreUrl) || "").trim() || null;
    if (objective === "OUTCOME_APP_PROMOTION" && (!appId || !objectStoreUrl)) {
        return { error: "App promotion requires a selected registered app and its App Store or Play Store URL" };
    }
    const targeting = object(raw === null || raw === void 0 ? void 0 : raw.targeting);
    if (!targeting.geo_locations)
        return { error: "Meta targeting requires at least one location" };
    if (((_b = (_a = object(raw)) === null || _a === void 0 ? void 0 : _a.policyCheck) === null || _b === void 0 ? void 0 : _b.status) === "FAIL")
        return { error: "This plan contains prohibited content and cannot be launched" };
    return {
        plan: {
            campaignName: campaignName.slice(0, 120),
            objective,
            dailyBudget,
            adSetName: String((raw === null || raw === void 0 ? void 0 : raw.adSetName) || `${campaignName} Ad Set`).slice(0, 120),
            optimizationGoal: String((raw === null || raw === void 0 ? void 0 : raw.optimizationGoal) || "LINK_CLICKS"),
            billingEvent: String((raw === null || raw === void 0 ? void 0 : raw.billingEvent) || "IMPRESSIONS"),
            targeting,
            placements: object(raw === null || raw === void 0 ? void 0 : raw.placements),
            pageId,
            instagramActorId: String((raw === null || raw === void 0 ? void 0 : raw.instagramActorId) || "").trim() || null,
            pixelId,
            appId,
            objectStoreUrl,
            creative: {
                name: String(creative.name || `${campaignName} Ad`).slice(0, 120),
                primaryText: String(creative.primaryText || "").trim().slice(0, 2200),
                headline: String(creative.headline || "").trim().slice(0, 255),
                description: String(creative.description || "").trim().slice(0, 255),
                imageUrl,
                destinationUrl,
                callToAction: String(creative.callToAction || "LEARN_MORE"),
            },
        },
    };
}
function fingerprint(planRowId, plan) {
    return crypto.createHash("sha256").update(planRowId + JSON.stringify(plan)).digest("hex").slice(0, 40);
}
function promotedObject(plan) {
    if (plan.objective === "OUTCOME_LEADS")
        return { pixel_id: plan.pixelId, custom_event_type: "LEAD" };
    if (plan.objective === "OUTCOME_SALES")
        return { pixel_id: plan.pixelId, custom_event_type: "PURCHASE" };
    if (plan.objective === "OUTCOME_APP_PROMOTION")
        return { application_id: plan.appId, object_store_url: plan.objectStoreUrl };
    if (plan.objective === "OUTCOME_ENGAGEMENT")
        return { page_id: plan.pageId };
    return undefined;
}
export function launchPlanToMeta(params) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!MetaAdsService.isEnabled())
            return { ok: false, error: "Meta Ads is not enabled", code: "PREFLIGHT_BLOCK" };
        const planRow = yield prisma.campaignPlan.findFirst({
            where: { id: params.planRowId, userId: params.userId, workspaceId: params.workspaceId },
            include: { adAccount: { select: { currencyCode: true } } },
        });
        if (!planRow)
            return { ok: false, error: "Campaign plan not found", code: "NOT_FOUND" };
        if (planRow.platform !== "META")
            return { ok: false, error: "Campaign plan platform mismatch", code: "VALIDATION_FAILED" };
        if (planRow.status === "LIVE")
            return { ok: false, error: "This plan has already been launched", code: "ALREADY_LIVE" };
        if (planRow.status === "PUBLISHING")
            return { ok: false, error: "This plan is already publishing", code: "PUBLISH_IN_PROGRESS" };
        const validated = validateMetaPlanForLaunch(planRow.plan);
        if (!validated.plan || validated.error)
            return { ok: false, error: validated.error, code: "VALIDATION_FAILED" };
        const plan = validated.plan;
        const publishFingerprint = fingerprint(planRow.id, plan);
        if (planRow.publishFingerprint === publishFingerprint && planRow.externalCampaignId) {
            return { ok: true, campaignId: planRow.launchedCampaignId || undefined, externalCampaignId: planRow.externalCampaignId, adGroupsPublished: 1 };
        }
        const workspace = yield prisma.workspace.findUnique({ where: { id: params.workspaceId }, select: { dailyBudgetCeiling: true } });
        const activeBudget = yield prisma.campaign.aggregate({ where: { workspaceId: params.workspaceId, isLive: true }, _sum: { budgetAmount: true } });
        if ((workspace === null || workspace === void 0 ? void 0 : workspace.dailyBudgetCeiling) != null && Number(activeBudget._sum.budgetAmount || 0) + plan.dailyBudget > workspace.dailyBudgetCeiling) {
            return { ok: false, error: `Launching this would exceed your workspace daily budget ceiling of $${workspace.dailyBudgetCeiling}`, code: "BUDGET_CEILING" };
        }
        const integration = yield prisma.integration.findFirst({
            where: { userId: params.userId, workspaceId: params.workspaceId, platform: "META", hasAdsAccess: true, status: "ACTIVE" },
        });
        const accessToken = integration ? getIntegrationAccessToken(integration) : null;
        if (!integration || !accessToken)
            return { ok: false, error: "Reconnect Meta Ads before launching", code: "AUTH_REQUIRED" };
        const accountId = planRow.adAccountExternalId || integration.selectedAdAccountId || integration.accountId || "";
        if (!accountId)
            return { ok: false, error: "No Meta ad account selected", code: "PREFLIGHT_BLOCK" };
        const selectedAssets = object(object(integration.accountInfo).metaAssets);
        if (selectedAssets.pageId !== plan.pageId || (plan.pixelId && selectedAssets.pixelId !== plan.pixelId) || (plan.appId && selectedAssets.appId !== plan.appId)) {
            return { ok: false, error: "The plan references Meta assets that are not selected for this workspace", code: "PREFLIGHT_BLOCK" };
        }
        yield prisma.campaignPlan.update({ where: { id: planRow.id }, data: { status: "PUBLISHING" } });
        const remoteIds = [];
        let imageHash = null;
        try {
            const campaign = yield MetaAdsService.createCampaign(accessToken, accountId, { name: plan.campaignName, objective: plan.objective });
            remoteIds.push(campaign.id);
            const adSet = yield MetaAdsService.createAdSet(accessToken, accountId, {
                name: plan.adSetName,
                campaignId: campaign.id,
                dailyBudgetMinor: currencyMinorAmount(plan.dailyBudget, ((_a = planRow.adAccount) === null || _a === void 0 ? void 0 : _a.currencyCode) || "USD"),
                billingEvent: plan.billingEvent,
                optimizationGoal: plan.optimizationGoal,
                targeting: plan.targeting,
                placements: plan.placements,
                promotedObject: promotedObject(plan),
            });
            remoteIds.push(adSet.id);
            imageHash = yield MetaAdsService.uploadAdImage(accessToken, accountId, plan.creative.imageUrl);
            const creative = yield MetaAdsService.createAdCreative(accessToken, accountId, Object.assign(Object.assign({}, plan.creative), { pageId: plan.pageId, instagramActorId: plan.instagramActorId, imageHash }));
            remoteIds.push(creative.id);
            const ad = yield MetaAdsService.createAd(accessToken, accountId, { name: plan.creative.name, adSetId: adSet.id, creativeId: creative.id });
            remoteIds.push(ad.id);
            const localCampaign = yield prisma.campaign.create({
                data: {
                    workspaceId: params.workspaceId,
                    integrationId: integration.id,
                    userId: params.userId,
                    platform: "META",
                    externalId: campaign.id,
                    adAccountId: planRow.adAccountId,
                    adAccountExternalId: accountId,
                    name: plan.campaignName,
                    status: "PAUSED",
                    objective: plan.objective,
                    type: "META",
                    budgetAmount: plan.dailyBudget,
                    dailyBudget: plan.dailyBudget,
                    isLive: true,
                    liveStatus: "LIVE_PAUSED",
                    verifiedAt: new Date(),
                    syncedAt: new Date(),
                    hasCreative: true,
                    rawData: { source: "AI_PLAN_LAUNCH", campaignPlanId: planRow.id, meta: { adSetId: adSet.id, creativeId: creative.id, adId: ad.id } },
                },
            });
            const localAdGroup = yield prisma.adGroup.create({ data: { userId: params.userId, campaignId: localCampaign.id, externalId: adSet.id, name: plan.adSetName, status: "PAUSED", isLive: true } });
            yield prisma.ad.create({ data: { userId: params.userId, adGroupId: localAdGroup.id, externalId: ad.id, headlines: [{ text: plan.creative.headline }], descriptions: [{ text: plan.creative.primaryText }], finalUrl: plan.creative.destinationUrl, status: "PAUSED", isLive: true } });
            yield prisma.campaignPlan.update({ where: { id: planRow.id }, data: { status: "LIVE", launchedCampaignId: localCampaign.id, externalCampaignId: campaign.id, publishFingerprint, publishedAt: new Date() } });
            yield recordActivity({ userId: params.userId, workspaceId: params.workspaceId, adAccountId: planRow.adAccountId || accountId, type: "AI_PLAN_LAUNCHED", title: `${plan.campaignName} launched paused to Meta`, entityType: "Campaign", entityId: localCampaign.id, metadata: { campaignPlanId: planRow.id, externalCampaignId: campaign.id } });
            return { ok: true, campaignId: localCampaign.id, externalCampaignId: campaign.id, adGroupsPublished: 1 };
        }
        catch (error) {
            for (const id of [...remoteIds].reverse()) {
                yield MetaAdsService.deleteObject(accessToken, id).catch((rollbackError) => log("error", "services/meta-publish", "Rollback failed; manual cleanup required", { remoteId: id, message: rollbackError === null || rollbackError === void 0 ? void 0 : rollbackError.message }));
            }
            if (imageHash) {
                yield MetaAdsService.deleteAdImage(accessToken, accountId, imageHash).catch((rollbackError) => log("error", "services/meta-publish", "Image rollback failed; manual cleanup required", { imageHash, message: rollbackError === null || rollbackError === void 0 ? void 0 : rollbackError.message }));
            }
            const message = (error === null || error === void 0 ? void 0 : error.message) || "Meta campaign launch failed";
            log("error", "services/meta-publish", "Plan launch failed", { planRowId: planRow.id, message });
            yield prisma.campaignPlan.update({ where: { id: planRow.id }, data: { status: "FAILED", plan: Object.assign(Object.assign({}, planRow.plan), { lastLaunchError: message }) } }).catch(() => undefined);
            return { ok: false, error: message, code: "PROVIDER_ERROR" };
        }
    });
}
