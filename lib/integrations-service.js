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
import { syncGoogleIntegration } from "@/lib/sync-engine";
export function syncAllUserIntegrations() {
    return __awaiter(this, void 0, void 0, function* () {
        const integrations = yield prisma.integration.findMany({
            where: { selectedAdAccountId: { not: null } },
        });
        const results = [];
        for (const integration of integrations) {
            try {
                if (integration.platform === "GOOGLE") {
                    const campaignsSynced = yield syncGoogleIntegration(integration);
                    results.push({ userId: integration.userId, platform: integration.platform, status: "success", campaignsSynced });
                }
            }
            catch (err) {
                results.push({ userId: integration.userId, platform: integration.platform, status: "error", error: err.message });
            }
        }
        return results;
    });
}
