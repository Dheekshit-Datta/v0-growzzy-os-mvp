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
}
