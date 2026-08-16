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
import { recordActivity } from "@/lib/activity-log";
import { mutateCampaignStatusOnPlatform, mutateGoogleCampaignBudgetOnPlatform } from "@/lib/platform-mutation";
import { getIntegrationAccessToken } from "@/lib/integration-tokens";
// Real autopilot execution - only runs for workspaces that have explicitly
// opted into defaultAutomationMode="FULL" (default is "ALERT"; nobody gets
// this without deliberately choosing it in the Autopilot tab). Deliberately
// narrow in what it will auto-execute:
//   - PAUSE: always reversible (re-enable), stops active waste. Real
//     money-safety upside, low downside.
//   - BUDGET_INCREASE: hard-capped at the workspace's own
//     dailyBudgetCeiling - autopilot can never push spend above what the
//     user explicitly said is their ceiling, no matter what a suggestion
//     recommends.
// CREATIVE_REFRESH and anything advisory-only never auto-executes - those
// need a human to actually look at creative, not just click a button.
const AUTO_EXECUTABLE_TYPES = new Set(["PAUSE", "BUDGET_INCREASE"]);
export function runAutopilotForWorkspace(input) {
    return __awaiter(this, void 0, void 0, function* () {
        const workspace = yield prisma.workspace.findUnique({
            where: { id: input.workspaceId },
            select: { id: true },
        }).catch(() => null);
        if (!workspace)
            return { ranAutopilot: false, actions: [] };
        const suggestions = yield prisma.optimizationSuggestion.findMany({
            where: {
                workspaceId: input.workspaceId,
                userId: input.userId,
                applied: false,
                dismissed: false,
                actionType: { in: Array.from(AUTO_EXECUTABLE_TYPES) },
            },
        });
        const actions = [];
        for (const suggestion of suggestions) {
            if (!suggestion.campaignId || !suggestion.actionType)
                continue;
            // stopLossEnabled gates the protective (PAUSE) action specifically -
            // a user who disabled stop-loss protection is saying "don't
            // automatically pause my campaigns even if they look bad," which
            // autopilot must respect.
            if (suggestion.actionType === "PAUSE" && workspace.stopLossEnabled === false)
                continue;
            const campaign = yield prisma.campaign.findFirst({
                where: { id: suggestion.campaignId, userId: input.userId, workspaceId: input.workspaceId },
                include: { integration: { include: { adAccounts: true } } },
            });
            if (!campaign)
                continue;
            if (campaign.platform !== "GOOGLE" ||
                !campaign.integration ||
                !getIntegrationAccessToken(campaign.integration) ||
                !campaign.integration.selectedAdAccountId)
                continue;
            let targetBudget = null;
            if (suggestion.actionType === "BUDGET_INCREASE") {
                const requested = Number(suggestion.recommendedValue || 0);
                if (!Number.isFinite(requested) || requested <= 0)
                    continue;
                // Never exceed the workspace's own ceiling, regardless of what the
                // suggestion asked for - this is the hard money-safety boundary.
                const ceiling = workspace.dailyBudgetCeiling;
                targetBudget = ceiling ? Math.min(requested, ceiling) : requested;
            }
            const previousValue = suggestion.actionType === "BUDGET_INCREASE" ? String(campaign.budgetAmount || 0) : String(campaign.status);
            const log = yield prisma.optimizationLog.create({
                data: {
                    userId: input.userId,
                    workspaceId: input.workspaceId,
                    adAccountId: campaign.adAccountId,
                    campaignId: campaign.id,
                    type: suggestion.actionType,
                    previousValue,
                    appliedValue: targetBudget != null ? String(targetBudget) : String(suggestion.actionType === "PAUSE" ? "PAUSED" : ""),
                    status: "PENDING_APPROVAL",
                    riskLevel: suggestion.actionType === "PAUSE" ? "HIGH" : "MEDIUM",
                    confidence: Math.round(suggestion.confidence),
                    source: "AUTOPILOT",
                    apiSuccess: false,
                },
            });
            let apiSuccess = false;
            let apiError = null;
            try {
                if (suggestion.actionType === "BUDGET_INCREASE" && targetBudget != null) {
                    yield mutateGoogleCampaignBudgetOnPlatform(campaign, targetBudget);
                    yield prisma.campaign.update({ where: { id: campaign.id }, data: { budgetAmount: targetBudget } });
                    apiSuccess = true;
                }
                else if (suggestion.actionType === "PAUSE") {
                    yield mutateCampaignStatusOnPlatform(campaign, "PAUSED");
                    yield prisma.campaign.update({ where: { id: campaign.id }, data: { status: "PAUSED", liveStatus: "LIVE_PAUSED" } });
                    apiSuccess = true;
                }
            }
            catch (error) {
                apiError = (error === null || error === void 0 ? void 0 : error.message) || "Google Ads update failed";
            }
            yield prisma.optimizationLog.update({
                where: { id: log.id },
                data: {
                    apiSuccess,
                    apiError,
                    error: apiError,
                    status: apiError ? "FAILED" : "APPLIED",
                    approvedAt: apiError ? null : new Date(),
                },
            });
            if (!apiError) {
                yield prisma.optimizationSuggestion.update({ where: { id: suggestion.id }, data: { applied: true } });
                yield recordActivity({
                    userId: input.userId,
                    workspaceId: input.workspaceId,
                    adAccountId: campaign.adAccountId,
                    type: "AUTOPILOT_APPLIED",
                    title: `Autopilot: ${suggestion.actionType} on ${campaign.name}`,
                    message: `${previousValue} -> ${log.appliedValue} - applied automatically under Full Autopilot mode.`,
                    entityType: "OptimizationLog",
                    entityId: log.id,
                });
                actions.push(`${suggestion.actionType} on ${campaign.name}`);
            }
        }
        return { ranAutopilot: true, actions };
    });
}
