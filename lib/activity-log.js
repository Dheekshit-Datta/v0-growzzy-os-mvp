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
import { log } from "@/lib/logger";
export function recordActivity(input) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield prisma.activityLog.create({
                data: {
                    userId: input.userId,
                    workspaceId: input.workspaceId || null,
                    adAccountId: input.adAccountId || null,
                    type: input.type,
                    title: input.title,
                    message: input.message || null,
                    entityType: input.entityType || null,
                    entityId: input.entityId || null,
                    metadata: input.metadata ? input.metadata : undefined,
                },
            });
        }
        catch (error) {
            log("warn", "activity-log", "Failed to record activity", {
                message: error === null || error === void 0 ? void 0 : error.message,
                type: input.type,
                entityType: input.entityType,
            });
        }
    });
}
