import assert from "node:assert/strict"
import { currencyMinorAmount, validateMetaPlanForLaunch } from "../lib/services/meta-publish"
import { MetaAdsService } from "../services/integrations/meta"

async function main() {
  const base = {
    campaignName: "Launch check",
    objective: "OUTCOME_TRAFFIC",
    dailyBudget: 1,
    adSetName: "Launch check ad set",
    optimizationGoal: "LINK_CLICKS",
    billingEvent: "IMPRESSIONS",
    targeting: { geo_locations: { countries: ["US"] } },
    pageId: "page-1",
    creative: { name: "Ad", primaryText: "Text", headline: "Headline", imageUrl: "https://example.com/image.jpg", destinationUrl: "https://example.com", callToAction: "LEARN_MORE" },
  }
  assert.ok(validateMetaPlanForLaunch(base).plan)
  assert.match(validateMetaPlanForLaunch({ ...base, objective: "OUTCOME_LEADS" }).error || "", /Pixel/)
  assert.match(validateMetaPlanForLaunch({ ...base, objective: "OUTCOME_APP_PROMOTION" }).error || "", /registered app/)
  assert.match(validateMetaPlanForLaunch({ ...base, pageId: "" }).error || "", /Facebook Page/)
  assert.equal(currencyMinorAmount(1.23, "USD"), 123)
  assert.equal(currencyMinorAmount(123, "JPY"), 123)

  const originalFetch = global.fetch
  const originalEnv = { ...process.env }
  const calls: Array<{ url: string; init?: RequestInit }> = []
  try {
    process.env.ENABLE_META_ADS = "true"
    process.env.META_GRAPH_API_VERSION = "v99.0"
    global.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), init })
      if (String(input).endsWith("/adimages")) return Response.json({ images: { test: { hash: "image-hash" } } })
      return Response.json({ id: `id-${calls.length}`, success: true })
    }) as typeof fetch

    await MetaAdsService.createCampaign("secret-token", "act_1", { name: "Campaign", objective: "OUTCOME_TRAFFIC" })
    await MetaAdsService.createAdSet("secret-token", "act_1", { name: "Ad Set", campaignId: "1", dailyBudgetMinor: 100, billingEvent: "IMPRESSIONS", optimizationGoal: "LINK_CLICKS", targeting: base.targeting })
    await MetaAdsService.uploadAdImage("secret-token", "act_1", "https://example.com/image.jpg")
    await MetaAdsService.createAdCreative("secret-token", "act_1", { name: "Creative", pageId: "page-1", imageHash: "image-hash", primaryText: "Text", headline: "Headline", destinationUrl: "https://example.com", callToAction: "LEARN_MORE" })
    await MetaAdsService.createAd("secret-token", "act_1", { name: "Ad", adSetId: "2", creativeId: "3" })
    await MetaAdsService.deleteObject("secret-token", "4")
    await MetaAdsService.deleteAdImage("secret-token", "act_1", "image-hash")

    assert.ok(calls.every((call) => !call.url.includes("secret-token")))
    assert.ok(calls.every((call) => new Headers(call.init?.headers).get("Authorization") === "Bearer secret-token"))
    assert.equal(new URLSearchParams(String(calls[0]?.init?.body)).get("status"), "PAUSED")
    assert.equal(new URLSearchParams(String(calls[1]?.init?.body)).get("status"), "PAUSED")
    assert.equal(new URLSearchParams(String(calls[4]?.init?.body)).get("status"), "PAUSED")
    assert.equal(calls[5]?.init?.method, "DELETE")
    assert.equal(new URLSearchParams(String(calls[6]?.init?.body)).get("hash"), "image-hash")
    console.log("Meta launch checks passed")
  } finally {
    global.fetch = originalFetch
    process.env = originalEnv
  }
}

main()
