import { prisma } from "@/lib/prisma"
import { syncGoogleIntegration } from "@/lib/sync-engine"

export async function syncAllUserIntegrations() {
  const integrations = await prisma.integration.findMany({
    where: { selectedAdAccountId: { not: null } },
  })

  const results: any[] = []
  for (const integration of integrations) {
    try {
      if (integration.platform === "GOOGLE") {
        const campaignsSynced = await syncGoogleIntegration(integration)
        results.push({ userId: integration.userId, platform: integration.platform, status: "success", campaignsSynced })
      }
    } catch (err: any) {
      results.push({ userId: integration.userId, platform: integration.platform, status: "error", error: err.message })
    }
  }
  return results
}
