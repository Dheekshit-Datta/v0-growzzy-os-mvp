const META_GRAPH_BASE_URL = "https://graph.facebook.com"
const META_OAUTH_BASE_URL = "https://www.facebook.com"
const DEFAULT_META_SCOPE = "ads_read,ads_management,business_management,pages_show_list,pages_read_engagement"
const REQUEST_TIMEOUT_MS = 20_000

export class MetaApiError extends Error {
  endpoint: string
  status: number
  payload?: unknown

  constructor(endpoint: string, status: number, message: string, payload?: unknown) {
    super(`Meta API request failed at ${endpoint} (status ${status}): ${message}`)
    this.name = "MetaApiError"
    this.endpoint = endpoint
    this.status = status
    this.payload = payload
  }
}

export type MetaDiscoveredAccount = {
  externalId: string
  name: string
  currency: string
  status?: string
  businessName?: string | null
}

export type MetaTokenResponse = {
  access_token?: string
  token_type?: string
  expires_in?: number
  error?: { message?: string; type?: string; code?: number }
}

export type MetaAssets = {
  pages: Array<{ id: string; name: string; instagramActor?: { id: string; name: string } | null }>
  pixels: Array<{ id: string; name: string }>
  apps: Array<{ id: string; name: string }>
}

function firstActionValue(rows: unknown, types: string[]): number {
  const values = Array.isArray(rows) ? rows : []
  for (const type of types) {
    const match = values.find((item: any) => item?.action_type === type)
    if (match) return Number(match.value || 0)
  }
  return 0
}

export function parseMetaInsight(row: any) {
  const leads = firstActionValue(row.actions, ["offsite_conversion.fb_pixel_lead", "onsite_conversion.lead_grouped", "lead"])
  const purchases = firstActionValue(row.actions, ["offsite_conversion.fb_pixel_purchase", "omni_purchase", "purchase"])
  return {
    spend: Number(row.spend || 0),
    clicks: Number(row.clicks || 0),
    impressions: Number(row.impressions || 0),
    conversions: leads + purchases,
    leads,
    revenue: firstActionValue(row.action_values, ["offsite_conversion.fb_pixel_purchase", "omni_purchase", "purchase"]),
  }
}

function required(name: string): string {
  const value = String(process.env[name] || "").trim()
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function graphVersion(): string {
  const version = required("META_GRAPH_API_VERSION")
  if (!/^v\d+\.\d+$/.test(version)) throw new Error("META_GRAPH_API_VERSION must look like vXX.X")
  return version
}

function redirectUri(override?: string): string {
  return String(override || process.env.META_REDIRECT_URI || "").trim() || required("META_REDIRECT_URI")
}

async function fetchMeta(url: string | URL, init: RequestInit = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), cache: "no-store" })
}

async function requestMeta<T>({
  endpoint,
  accessToken,
  params,
}: {
  endpoint: string
  accessToken: string
  params?: Record<string, string>
}): Promise<T> {
  const url = new URL(`${META_GRAPH_BASE_URL}/${graphVersion()}${endpoint}`)
  for (const [key, value] of Object.entries(params || {})) url.searchParams.set(key, value)

  const response = await fetchMeta(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload?.error) {
    throw new MetaApiError(endpoint, response.status, payload?.error?.message || response.statusText || "Unknown Meta API error", payload)
  }
  return payload as T
}

async function mutateMeta<T>({
  endpoint,
  accessToken,
  fields,
  method = "POST",
}: {
  endpoint: string
  accessToken: string
  fields?: Record<string, string>
  method?: "POST" | "DELETE"
}): Promise<T> {
  const response = await fetchMeta(`${META_GRAPH_BASE_URL}/${graphVersion()}${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: fields ? new URLSearchParams(fields) : undefined,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload?.error) {
    throw new MetaApiError(endpoint, response.status, payload?.error?.message || response.statusText || "Unknown Meta API error", payload)
  }
  return payload as T
}

async function paginateMeta({
  endpoint,
  accessToken,
  params,
  maxPages = 5,
  maxItems = 500,
}: {
  endpoint: string
  accessToken: string
  params: Record<string, string>
  maxPages?: number
  maxItems?: number
}) {
  const rows: any[] = []
  let after: string | undefined
  for (let page = 0; page < maxPages && rows.length < maxItems; page += 1) {
    const payload = await requestMeta<{ data?: any[]; paging?: { cursors?: { after?: string } } }>({
      endpoint,
      accessToken,
      params: { ...params, limit: "100", ...(after ? { after } : {}) },
    })
    rows.push(...(Array.isArray(payload.data) ? payload.data : []))
    const next = payload.paging?.cursors?.after
    if (!next || next === after || !payload.data?.length) break
    after = next
  }
  return rows.slice(0, maxItems)
}

function isoDate(daysAgo: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - daysAgo)
  return date.toISOString().slice(0, 10)
}

function normalizeMetaAdAccountId(id: string, accountId?: string): string {
  const candidate = accountId || id
  return candidate.startsWith("act_") ? candidate : `act_${candidate.replace(/^act_/, "")}`
}

export const MetaAdsService = {
  isEnabled() {
    return process.env.ENABLE_META_ADS === "true"
  },

  assertConfigured() {
    if (!this.isEnabled()) throw new Error("Meta Ads is disabled")
    required("META_APP_ID")
    required("META_APP_SECRET")
    graphVersion()
    redirectUri()
  },

  getRedirectUri: redirectUri,

  getAuthUrl(options?: { redirectUri?: string; state?: string }) {
    this.assertConfigured()
    const url = new URL(`${META_OAUTH_BASE_URL}/${graphVersion()}/dialog/oauth`)
    url.searchParams.set("client_id", required("META_APP_ID"))
    url.searchParams.set("redirect_uri", redirectUri(options?.redirectUri))
    url.searchParams.set("state", options?.state || crypto.randomUUID())
    url.searchParams.set("scope", String(process.env.META_OAUTH_SCOPES || DEFAULT_META_SCOPE).trim())
    url.searchParams.set("response_type", "code")
    return url.toString()
  },

  async exchangeCode(code: string, options?: { redirectUri?: string }): Promise<MetaTokenResponse> {
    this.assertConfigured()
    const response = await fetchMeta(`${META_GRAPH_BASE_URL}/${graphVersion()}/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: required("META_APP_ID"),
        client_secret: required("META_APP_SECRET"),
        redirect_uri: redirectUri(options?.redirectUri),
        code,
      }),
    })
    const payload = (await response.json().catch(() => ({}))) as MetaTokenResponse
    if (!response.ok || payload.error || !payload.access_token) {
      throw new Error(payload.error?.message || response.statusText || "Meta token exchange failed")
    }
    return payload
  },

  async exchangeLongLivedToken(shortLivedToken: string): Promise<MetaTokenResponse> {
    this.assertConfigured()
    const response = await fetchMeta(`${META_GRAPH_BASE_URL}/${graphVersion()}/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: required("META_APP_ID"),
        client_secret: required("META_APP_SECRET"),
        fb_exchange_token: shortLivedToken,
      }),
    })
    const payload = (await response.json().catch(() => ({}))) as MetaTokenResponse
    if (!response.ok || payload.error || !payload.access_token) {
      throw new Error(payload.error?.message || response.statusText || "Meta long-lived token exchange failed")
    }
    return payload
  },

  request: requestMeta,

  mutate: mutateMeta,

  async createCampaign(accessToken: string, adAccountId: string, input: { name: string; objective: string }) {
    return mutateMeta<{ id: string }>({
      endpoint: `/${normalizeMetaAdAccountId(adAccountId)}/campaigns`,
      accessToken,
      fields: { name: input.name, objective: input.objective, status: "PAUSED", special_ad_categories: "[]" },
    })
  },

  async createAdSet(accessToken: string, adAccountId: string, input: {
    name: string
    campaignId: string
    dailyBudgetMinor: number
    billingEvent: string
    optimizationGoal: string
    targeting: Record<string, unknown>
    placements?: Record<string, unknown>
    promotedObject?: Record<string, unknown>
  }) {
    return mutateMeta<{ id: string }>({
      endpoint: `/${normalizeMetaAdAccountId(adAccountId)}/adsets`,
      accessToken,
      fields: {
        name: input.name,
        campaign_id: input.campaignId,
        daily_budget: String(input.dailyBudgetMinor),
        billing_event: input.billingEvent,
        optimization_goal: input.optimizationGoal,
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        targeting: JSON.stringify(input.targeting),
        ...Object.fromEntries(Object.entries(input.placements || {}).map(([key, value]) => [key, JSON.stringify(value)])),
        ...(input.promotedObject ? { promoted_object: JSON.stringify(input.promotedObject) } : {}),
        status: "PAUSED",
      } as Record<string, string>,
    })
  },

  async uploadAdImage(accessToken: string, adAccountId: string, imageUrl: string) {
    const payload = await mutateMeta<{ images?: Record<string, { hash?: string }> }>({
      endpoint: `/${normalizeMetaAdAccountId(adAccountId)}/adimages`,
      accessToken,
      fields: { url: imageUrl },
    })
    const image = Object.values(payload.images || {})[0]
    if (!image?.hash) throw new Error("Meta did not return an uploaded image hash")
    return image.hash
  },

  deleteAdImage(accessToken: string, adAccountId: string, imageHash: string) {
    return mutateMeta<{ success?: boolean }>({
      endpoint: `/${normalizeMetaAdAccountId(adAccountId)}/adimages`,
      accessToken,
      method: "DELETE",
      fields: { hash: imageHash },
    })
  },

  async createAdCreative(accessToken: string, adAccountId: string, input: {
    name: string
    pageId: string
    instagramActorId?: string | null
    imageHash: string
    primaryText: string
    headline: string
    description?: string
    destinationUrl: string
    callToAction: string
  }) {
    const objectStorySpec = {
      page_id: input.pageId,
      ...(input.instagramActorId ? { instagram_user_id: input.instagramActorId } : {}),
      link_data: {
        image_hash: input.imageHash,
        link: input.destinationUrl,
        message: input.primaryText,
        name: input.headline,
        ...(input.description ? { description: input.description } : {}),
        call_to_action: { type: input.callToAction, value: { link: input.destinationUrl } },
      },
    }
    return mutateMeta<{ id: string }>({
      endpoint: `/${normalizeMetaAdAccountId(adAccountId)}/adcreatives`,
      accessToken,
      fields: { name: input.name, object_story_spec: JSON.stringify(objectStorySpec) },
    })
  },

  async createAd(accessToken: string, adAccountId: string, input: { name: string; adSetId: string; creativeId: string }) {
    return mutateMeta<{ id: string }>({
      endpoint: `/${normalizeMetaAdAccountId(adAccountId)}/ads`,
      accessToken,
      fields: { name: input.name, adset_id: input.adSetId, creative: JSON.stringify({ creative_id: input.creativeId }), status: "PAUSED" },
    })
  },

  updateCampaignStatus(accessToken: string, campaignId: string, status: "ACTIVE" | "PAUSED" | "ARCHIVED") {
    return mutateMeta<{ success?: boolean }>({ endpoint: `/${campaignId}`, accessToken, fields: { status } })
  },

  updateAdSetBudget(accessToken: string, adSetId: string, dailyBudgetMinor: number) {
    return mutateMeta<{ success?: boolean }>({ endpoint: `/${adSetId}`, accessToken, fields: { daily_budget: String(dailyBudgetMinor) } })
  },

  deleteObject(accessToken: string, id: string) {
    return mutateMeta<{ success?: boolean }>({ endpoint: `/${id}`, accessToken, method: "DELETE" })
  },

  async discoverAdAccounts(accessToken: string): Promise<MetaDiscoveredAccount[]> {
    const data = await requestMeta<{ data?: any[] }>({
      endpoint: "/me/adaccounts",
      accessToken,
      params: { fields: "id,account_id,name,currency,account_status,timezone_name,business{name}", limit: "100" },
    })
    return (Array.isArray(data.data) ? data.data : [])
      .filter((account) => account?.id || account?.account_id)
      .map((account) => ({
        externalId: normalizeMetaAdAccountId(String(account.id || ""), String(account.account_id || "")),
        name: account.name || `Meta Ad Account ${account.account_id || account.id}`,
        currency: account.currency || "USD",
        status: account.account_status ? String(account.account_status) : undefined,
        businessName: account.business?.name || null,
      }))
  },

  async discoverAssets(accessToken: string, adAccountId: string): Promise<MetaAssets> {
    const [pageData, pixelData, businessData] = await Promise.all([
      requestMeta<{ data?: any[] }>({
        endpoint: "/me/accounts",
        accessToken,
        params: { fields: "id,name,instagram_business_account{id,username}", limit: "100" },
      }),
      requestMeta<{ data?: any[] }>({
        endpoint: `/${normalizeMetaAdAccountId(adAccountId)}/adspixels`,
        accessToken,
        params: { fields: "id,name", limit: "100" },
      }),
      requestMeta<{ data?: any[] }>({
        endpoint: "/me/businesses",
        accessToken,
        params: { fields: "id,name,owned_apps{id,name}", limit: "100" },
      }),
    ])

    return {
      pages: (pageData.data || []).slice(0, 100).map((page) => ({
        id: String(page.id),
        name: String(page.name || "Facebook Page"),
        instagramActor: page.instagram_business_account?.id
          ? { id: String(page.instagram_business_account.id), name: String(page.instagram_business_account.username || "Instagram") }
          : null,
      })),
      pixels: (pixelData.data || []).slice(0, 100).map((pixel) => ({ id: String(pixel.id), name: String(pixel.name || "Meta Pixel") })),
      apps: (businessData.data || [])
        .flatMap((business) => business.owned_apps?.data || [])
        .slice(0, 100)
        .map((app) => ({ id: String(app.id), name: String(app.name || "Meta App") })),
    }
  },

  async readAccountSnapshot(accessToken: string, adAccountId: string) {
    const account = `/${normalizeMetaAdAccountId(adAccountId)}`
    const timeRange = JSON.stringify({ since: isoDate(29), until: isoDate(0) })
    const [campaigns, adSets, ads, campaignInsights, adInsights] = await Promise.all([
      paginateMeta({
        endpoint: `${account}/campaigns`,
        accessToken,
        params: { fields: "id,name,status,effective_status,objective,daily_budget,lifetime_budget,created_time,updated_time" },
      }),
      paginateMeta({
        endpoint: `${account}/adsets`,
        accessToken,
        params: { fields: "id,name,status,effective_status,campaign_id,daily_budget,lifetime_budget,optimization_goal,billing_event,targeting" },
      }),
      paginateMeta({
        endpoint: `${account}/ads`,
        accessToken,
        params: { fields: "id,name,status,effective_status,adset_id,campaign_id,creative{id,name,title,body,image_url,thumbnail_url,object_story_spec}" },
      }),
      paginateMeta({
        endpoint: `${account}/insights`,
        accessToken,
        maxItems: 3_000,
        params: {
          level: "campaign",
          time_range: timeRange,
          time_increment: "1",
          fields: "campaign_id,date_start,spend,impressions,clicks,actions,action_values,ctr,cpc",
        },
      }),
      paginateMeta({
        endpoint: `${account}/insights`,
        accessToken,
        maxItems: 5_000,
        params: {
          level: "ad",
          time_range: timeRange,
          time_increment: "1",
          fields: "ad_id,campaign_id,date_start,spend,impressions,clicks,actions,action_values,ctr,cpc",
        },
      }),
    ])
    return { campaigns, adSets, ads, campaignInsights, adInsights }
  },
}
