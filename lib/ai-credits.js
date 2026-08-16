var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { prisma } from "./prisma.ts";
const DEFAULT_CREDITS_PER_USD = 0.001;
const MODEL_PRICES_PER_1K = {
    "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
    "gpt-4o": { input: 0.0025, output: 0.01 },
};
export class CreditQuotaError extends Error {
    constructor() {
        super(...arguments);
        this.code = "CREDIT_QUOTA_EXCEEDED";
        this.status = 402;
    }
}
function creditsPerUsd() {
    const value = Number(process.env.CREDIT_PER_USD);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_CREDITS_PER_USD;
}
export function creditsForUsage(model, inputTokens = 0, outputTokens = 0) {
    const price = MODEL_PRICES_PER_1K[model] || MODEL_PRICES_PER_1K["gpt-4o"];
    const costUsd = (inputTokens / 1000) * price.input + (outputTokens / 1000) * price.output;
    return { costUsd, credits: Math.max(1, Math.ceil(costUsd / creditsPerUsd())) };
}
export function estimatedCredits(model) {
    return creditsForUsage(model, 2000, 1000).credits;
}
export function creditResetDate(year, month, day) {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(Math.max(day, 1), lastDay));
}
export function assertCreditsAvailable(workspaceId, estimated) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const workspace = yield prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { id: true },
            });
            return workspace;
        }
        catch (error) {
            if (error instanceof CreditQuotaError)
                throw error;
            console.warn("Credit check bypassed:", (error === null || error === void 0 ? void 0 : error.message) || error);
            return null;
        }
    });
}
export function recordCreditUsage(input) {
    return __awaiter(this, void 0, void 0, function* () {
        const inputTokens = input.inputTokens || 0;
        const outputTokens = input.outputTokens || 0;
        const usage = creditsForUsage(input.model, inputTokens, outputTokens);
        if (usage.credits <= 0)
            return usage;
        try {
            if (prisma.creditUsageLog) {
                yield prisma.creditUsageLog.create({
                    data: {
                        workspaceId: input.workspaceId,
                        userId: input.userId,
                        route: input.route,
                        model: input.model,
                        inputTokens,
                        outputTokens,
                        credits: usage.credits,
                        costUsd: usage.costUsd,
                    },
                });
            }
        }
        catch (error) {
            console.warn("Could not log credit usage:", (error === null || error === void 0 ? void 0 : error.message) || error);
        }
        return usage;
    });
}
export function recordFixedCreditUsage(input) {
    return __awaiter(this, void 0, void 0, function* () {
        const credits = Math.max(1, Math.ceil(input.credits));
        try {
            yield prisma.creditUsageLog.create({
                data: {
                    workspaceId: input.workspaceId,
                    userId: input.userId,
                    route: input.route,
                    model: input.model,
                    inputTokens: 0,
                    outputTokens: 0,
                    credits,
                    costUsd: credits * DEFAULT_CREDITS_PER_USD,
                },
            });
        }
        catch (error) {
            if ((error === null || error === void 0 ? void 0 : error.code) !== "P2021") {
                console.warn("Could not log fixed credit usage:", (error === null || error === void 0 ? void 0 : error.message) || error);
            }
        }
        return { costUsd: credits * DEFAULT_CREDITS_PER_USD, credits };
    });
}
export function resetDueWorkspaceCredits() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const now = new Date();
            const currentDay = now.getDate();
            return { count: 0 };
        }
        catch (error) {
            console.warn("resetDueWorkspaceCredits skipped:", error);
            return { count: 0 };
        }
    });
}
