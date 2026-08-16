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
const MAX_BUDGET_CHANGE_PCT = 0.3;
export function executeBudgetChange(campaignId, userId, automationId, targetDailyBudget) {
    return __awaiter(this, void 0, void 0, function* () {
        const campaign = yield prisma.campaign.findFirst({
            where: { id: campaignId, userId },
            select: { id: true, dailyBudget: true },
        });
        if (!campaign) {
            return { success: false, actionTaken: "budget_change", before: {}, after: {}, rollbackAvailable: false, message: "Campaign not found" };
        }
        const currentBudget = Number(campaign.dailyBudget || 0);
        const maxBudget = currentBudget ? currentBudget * (1 + MAX_BUDGET_CHANGE_PCT) : targetDailyBudget;
        const minBudget = currentBudget ? currentBudget * (1 - MAX_BUDGET_CHANGE_PCT) : targetDailyBudget;
        const safeBudget = Math.min(maxBudget, Math.max(minBudget, targetDailyBudget));
        const before = { dailyBudget: currentBudget };
        const after = { dailyBudget: safeBudget };
        const actionTaken = `budget_change:${campaignId}:${safeBudget.toFixed(0)}`;
        yield prisma.automationLog.create({
            data: {
                automationId,
                actionTaken,
                result: JSON.stringify({ before, after, approvalRequired: true }),
                success: false,
                impact: "Budget change queued for approval; no live campaign was modified.",
            },
        });
        return {
            success: false,
            actionTaken,
            before,
            after,
            rollbackAvailable: false,
            message: "Automation budget changes require explicit approval through AI Advisor preview/apply.",
        };
    });
}
export function executeCampaignStatusChange(campaignId, userId, automationId, newStatus) {
    return __awaiter(this, void 0, void 0, function* () {
        const campaign = yield prisma.campaign.findFirst({
            where: { id: campaignId, userId },
            select: { id: true, status: true },
        });
        if (!campaign) {
            return { success: false, actionTaken: "status_change", before: {}, after: {}, rollbackAvailable: false, message: "Campaign not found" };
        }
        const before = { status: campaign.status };
        const after = { status: newStatus };
        const actionTaken = `status_change:${campaignId}:${newStatus}`;
        yield prisma.automationLog.create({
            data: {
                automationId,
                actionTaken,
                result: JSON.stringify({ before, after, approvalRequired: true }),
                success: false,
                impact: "Campaign status change queued for approval; no live campaign was modified.",
            },
        });
        return {
            success: false,
            actionTaken,
            before,
            after,
            rollbackAvailable: false,
            message: "Automation status changes require explicit approval through AI Advisor preview/apply.",
        };
    });
}
export function rollbackLastAction(automationId) {
    return __awaiter(this, void 0, void 0, function* () {
        yield prisma.automationLog.create({
            data: {
                automationId,
                actionTaken: "rollback:not_required",
                result: JSON.stringify({ approvalOnly: true }),
                success: false,
                impact: "Rollback skipped because automation actions no longer mutate campaigns directly.",
            },
        });
        return {
            success: false,
            actionTaken: "rollback:not_required",
            before: {},
            after: {},
            rollbackAvailable: false,
            message: "No rollback was needed because automation actions require approval before any provider mutation.",
        };
    });
}
export function markSuggestion(suggestionId, action) {
    return __awaiter(this, void 0, void 0, function* () {
        yield prisma.optimizationSuggestion.update({
            where: { id: suggestionId },
            data: action === "applied" ? { applied: true, dismissed: false } : { dismissed: true, applied: false },
        });
    });
}
