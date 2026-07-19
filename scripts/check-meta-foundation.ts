import assert from "node:assert/strict"
import { MetaAdsService, parseMetaInsight } from "../services/integrations/meta"
import { stateMatches } from "../lib/oauth-state"

async function main() {
  const original = { ...process.env }
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const originalFetch = global.fetch

  try {
    process.env.ENABLE_META_ADS = "false"
    assert.equal(MetaAdsService.isEnabled(), false)
    assert.equal(stateMatches("known-state", "known-state"), true)
    assert.equal(stateMatches("known-state", "wrong-state"), false)
    assert.equal(stateMatches(null, "known-state"), false)

    const insight = parseMetaInsight({
      spend: "12.50",
      impressions: "1000",
      clicks: "25",
      actions: [
        { action_type: "lead", value: "3" },
        { action_type: "purchase", value: "2" },
      ],
      action_values: [{ action_type: "purchase", value: "49.95" }],
    })
    assert.deepEqual(insight, { spend: 12.5, impressions: 1000, clicks: 25, conversions: 5, leads: 3, revenue: 49.95 })
    assert.equal(parseMetaInsight({ actions: [{ action_type: "purchase", value: "9" }] }).revenue, 0)

    process.env.ENABLE_META_ADS = "true"
    delete process.env.META_GRAPH_API_VERSION
    assert.throws(() => MetaAdsService.assertConfigured(), /META_APP_ID|META_GRAPH_API_VERSION/)

    process.env.META_APP_ID = "test-app"
    process.env.META_APP_SECRET = "test-secret"
    process.env.META_GRAPH_API_VERSION = "v99.0"
    process.env.META_REDIRECT_URI = "https://example.com/api/auth/meta/callback"

    const authUrl = new URL(MetaAdsService.getAuthUrl({ state: "known-state" }))
    assert.equal(authUrl.searchParams.get("state"), "known-state")
    assert.equal(authUrl.searchParams.get("redirect_uri"), process.env.META_REDIRECT_URI)

    global.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, init })
      if (url.includes("oauth/access_token")) {
        return Response.json({ access_token: "test-token", expires_in: 3600 })
      }
      return Response.json({ data: [{ id: "act_123", account_id: "123", name: "Test", currency: "USD" }] })
    }) as typeof fetch

    await MetaAdsService.exchangeCode("test-code")
    const accounts = await MetaAdsService.discoverAdAccounts("test-token")
    assert.equal(accounts[0]?.externalId, "act_123")
    assert.equal(calls[0]?.url.includes("test-secret"), false)
    assert.match(String(calls[0]?.init?.body), /client_secret=test-secret/)
    assert.equal(new Headers(calls[1]?.init?.headers).get("Authorization"), "Bearer test-token")
    assert.equal(calls[1]?.url.includes("access_token"), false)
    console.log("Meta foundation checks passed")
  } finally {
    global.fetch = originalFetch
    process.env = original
  }
}

main()
