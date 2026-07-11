const DEFAULT_META_GRAPH_VERSION = "v19.0"
const META_GRAPH_VERSION = (process.env.META_GRAPH_API_VERSION || DEFAULT_META_GRAPH_VERSION).trim()
const META_GRAPH_BASE_URL = "https://graph.facebook.com"
const META_OAUTH_BASE_URL = "https://www.facebook.com"
const DEFAULT_META_SCOPE = "ads_read,ads_management,business_management"

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

type MetaTokenResponse = {
  access_token?: string
  token_type?: string
  expires_in?: number
  error?: {
    message?: string
    type?: string
    code?: number
  }
}

function getMetaAppId(): string {
  return (process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID || "").trim()
}

function getMetaAppSecret(): string {
  const secret = (process.env.META_APP_SECRET || "").trim()
  if (!secret) throw new Error("Missing META_APP_SECRET")
  return secret
}

function getRedirectUri(override?: string): string {
  return (
    override ||
    process.env.META_REDIRECT_URI ||
    process.env.NEXT_PUBLIC_META_REDIRECT_URI ||
    "https://v0-growzzyos.vercel.app/api/auth/meta/callback"
  ).trim()
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
  const url = new URL(`${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}${endpoint}`)
  url.searchParams.set("access_token", accessToken)
  for (const [key, value] of Object.entries(params || {})) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload?.error) {
    const message = payload?.error?.message || response.statusText || "Unknown Meta API error"
    throw new MetaApiError(endpoint, response.status, message, payload)
  }

  return payload as T
}

function normalizeMetaAdAccountId(id: string, accountId?: string): string {
  if (id.startsWith("act_")) return id
  const candidate = accountId || id
  return candidate.startsWith("act_") ? candidate : `act_${candidate.replace(/^act_/, "")}`
}

export const MetaAdsService = {
  GRAPH_VERSION: META_GRAPH_VERSION,

  getRedirectUri,

  getAuthUrl(options?: { redirectUri?: string; state?: string }) {
    const appId = getMetaAppId()
    if (!appId) throw new Error("Missing META_APP_ID")

    const redirectUri = getRedirectUri(options?.redirectUri)
    const scope = (process.env.META_OAUTH_SCOPES || DEFAULT_META_SCOPE).trim()
    const state = options?.state || Math.random().toString(36).slice(2)
    const url = new URL(`${META_OAUTH_BASE_URL}/${META_GRAPH_VERSION}/dialog/oauth`)

    url.searchParams.set("client_id", appId)
    url.searchParams.set("redirect_uri", redirectUri)
    url.searchParams.set("state", state)
    url.searchParams.set("scope", scope)
    url.searchParams.set("response_type", "code")

    return url.toString()
  },

  async exchangeCode(code: string, options?: { redirectUri?: string }): Promise<MetaTokenResponse> {
    const appId = getMetaAppId()
    if (!appId) throw new Error("Missing META_APP_ID")

    const url = new URL(`${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/oauth/access_token`)
    url.searchParams.set("client_id", appId)
    url.searchParams.set("client_secret", getMetaAppSecret())
    url.searchParams.set("redirect_uri", getRedirectUri(options?.redirectUri))
    url.searchParams.set("code", code)

    const response = await fetch(url)
    const payload = (await response.json().catch(() => ({}))) as MetaTokenResponse
    if (!response.ok || payload?.error || !payload.access_token) {
      throw new Error(payload?.error?.message || response.statusText || "Meta token exchange failed")
    }
    return payload
  },

  async exchangeLongLivedToken(shortLivedToken: string): Promise<MetaTokenResponse> {
    const appId = getMetaAppId()
    if (!appId) throw new Error("Missing META_APP_ID")

    const url = new URL(`${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/oauth/access_token`)
    url.searchParams.set("grant_type", "fb_exchange_token")
    url.searchParams.set("client_id", appId)
    url.searchParams.set("client_secret", getMetaAppSecret())
    url.searchParams.set("fb_exchange_token", shortLivedToken)

    const response = await fetch(url)
    const payload = (await response.json().catch(() => ({}))) as MetaTokenResponse
    if (!response.ok || payload?.error || !payload.access_token) {
      throw new Error(payload?.error?.message || response.statusText || "Meta long-lived token exchange failed")
    }
    return payload
  },

  async discoverAdAccounts(accessToken: string): Promise<MetaDiscoveredAccount[]> {
    const data = await requestMeta<{ data?: any[] }>({
      endpoint: "/me/adaccounts",
      accessToken,
      params: {
        fields: "id,account_id,name,currency,account_status,timezone_name,business{name}",
        limit: "100",
      },
    })

    const elements = Array.isArray(data?.data) ? data.data : []
    return elements
      .filter((account) => account?.id || account?.account_id)
      .map((account) => ({
        externalId: normalizeMetaAdAccountId(String(account.id || ""), String(account.account_id || "")),
        name: account.name || `Meta Ad Account ${account.account_id || account.id}`,
        currency: account.currency || "USD",
        status: account.account_status ? String(account.account_status) : undefined,
        businessName: account.business?.name || null,
      }))
  },
}

