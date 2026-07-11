import { log } from "@/lib/logger"

const DEFAULT_GOOGLE_ADS_API_VERSION = "v22"
const GOOGLE_ADS_API_VERSION = (
  process.env.GOOGLE_ADS_API_VERSION || DEFAULT_GOOGLE_ADS_API_VERSION
).trim()
const GOOGLE_OAUTH_SCOPE = [
  "https://www.googleapis.com/auth/adwords",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ")
const CANONICAL_GOOGLE_CLIENT_ID =
  "11828421627-n5mns7q2qq2b04rl5igefntjjru50hje.apps.googleusercontent.com"
const CUSTOMER_CLIENT_DISCOVERY_QUERY =
  "SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.level, customer_client.status FROM customer_client WHERE customer_client.status = 'ENABLED'"

type SearchStreamChunk<T> = {
  results?: T[]
}

type CustomerClientRow = {
  customerClient?: {
    id?: string | number
    descriptiveName?: string
    manager?: boolean
    level?: number
    status?: string
  }
}

type RetryRequestParams = {
  path: string
  accessToken: string
  method?: "GET" | "POST"
  body?: unknown
  loginCustomerId?: string | null
  maxRetries?: number
  apiVersion?: string
}

export class GoogleAdsApiError extends Error {
  path: string
  status: number
  summary: string
  errorCode?: string
  payload?: unknown
  apiVersion?: string
  loginCustomerId?: string | null
  hasLoginCustomerId?: boolean
  hasDeveloperToken?: boolean

  constructor({
    path,
    status,
    summary,
    errorCode,
    payload,
    apiVersion,
    loginCustomerId,
    hasDeveloperToken,
  }: {
    path: string
    status: number
    summary: string
    errorCode?: string
    payload?: unknown
    apiVersion?: string
    loginCustomerId?: string | null
    hasDeveloperToken?: boolean
  }) {
    const versionNote = apiVersion ? ` [${apiVersion}]` : ""
    const loginNote = loginCustomerId ? ` [login-customer-id:${normalizeCustomerId(loginCustomerId)}]` : ""
    const tokenNote = hasDeveloperToken === false ? " [developer-token:missing]" : ""
    super(
      `Google Ads API request failed at ${path}${versionNote}${loginNote}${tokenNote} (status ${status}): ${summary}`
    )
    this.name = "GoogleAdsApiError"
    this.path = path
    this.status = status
    this.summary = summary
    this.errorCode = errorCode
    this.payload = payload
    this.apiVersion = apiVersion
    this.loginCustomerId = loginCustomerId
    this.hasLoginCustomerId = Boolean(loginCustomerId)
    this.hasDeveloperToken = hasDeveloperToken
  }
}

export type GoogleDiscoveredAccount = {
  externalId: string
  name: string
  currency: string
  managerCustomerId: string | null
  isManager: boolean
  level?: number
  status?: string
  discoveryFallback?: "AUTHORIZATION"
}

function flattenErrorCandidates(input: any): any[] {
  if (!input) return []
  if (Array.isArray(input)) return input.flatMap((x) => flattenErrorCandidates(x))
  if (typeof input !== "object") return []
  return [input]
}

function getGoogleAdsErrorSummary(errorPayload: any): { summary: string; errorCode?: string } {
  const candidates = flattenErrorCandidates(errorPayload)
  const firstMessage =
    candidates.find((entry) => typeof entry?.error?.message === "string")?.error?.message ||
    candidates.find((entry) => typeof entry?.message === "string")?.message ||
    "Unknown Google Ads API error"

  const firstGoogleAdsError = candidates
    .find((entry) => Array.isArray(entry?.error?.details))
    ?.error?.details?.find((detail: any) => Array.isArray(detail?.errors) && detail.errors.length > 0)
    ?.errors?.[0]

  const firstErrorCode = firstGoogleAdsError?.errorCode || candidates.find((entry) => entry?.errorCode)?.errorCode
  const parsedCode =
    firstErrorCode && typeof firstErrorCode === "object"
      ? Object.keys(firstErrorCode)[0]
      : typeof firstErrorCode === "string"
        ? firstErrorCode
        : undefined

  return {
    summary: firstMessage,
    errorCode: parsedCode,
  }
}

function isAuthorizationDiscoveryError(error: unknown): boolean {
  if (!(error instanceof GoogleAdsApiError)) return false
  if (error.status !== 403) return false

  const code = (error.errorCode || "").toLowerCase()
  const summary = (error.summary || "").toLowerCase()
  return code.includes("authorizationerror") || summary.includes("does not have permission")
}

function normalizeCustomerId(customerId: string | number): string {
  return String(customerId).replace(/\D/g, "")
}

function getGoogleClientId(): string {
  return (process.env.GOOGLE_CLIENT_ID || CANONICAL_GOOGLE_CLIENT_ID).trim()
}

function getGoogleClientSecret(): string {
  const primarySecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim()
  if (primarySecret) return primarySecret

  const legacySecret = (process.env.GOOGLE_ADS_CLIENT_SECRET || "").trim()
  if (legacySecret) {
    console.warn("[Google OAuth] GOOGLE_CLIENT_SECRET missing; using GOOGLE_ADS_CLIENT_SECRET fallback")
    return legacySecret
  }

  throw new Error("Missing GOOGLE_CLIENT_SECRET environment variable for Google OAuth token exchange")
}

function resolveRedirectUri(override?: string): string {
  return (override || process.env.GOOGLE_REDIRECT_URI || "https://v0-growzzyos.vercel.app/api/auth/google/callback").trim()
}

function parseGoogleAdsErrorCodes(errorPayload: any): string[] {
  const payload = JSON.stringify(errorPayload || {})
  const knownCodes = ["RATE_EXCEEDED", "EXCESSIVE_RESOURCE_CONSUMPTION"]
  return knownCodes.filter((code) => payload.includes(code))
}

function isRetryableGoogleAdsError(status: number, errorPayload: any): boolean {
  if (status === 429 || status === 503) return true
  return parseGoogleAdsErrorCodes(errorPayload).length > 0
}

function buildGoogleAdsHeaders(accessToken: string, loginCustomerId?: string | null): Record<string, string> {
  const developerToken = (process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "").trim()
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  }

  if (loginCustomerId) {
    headers["login-customer-id"] = normalizeCustomerId(loginCustomerId)
  }

  return headers
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function getGoogleAdsBaseUrl(apiVersion: string): string {
  return `https://googleads.googleapis.com/${apiVersion}`
}

function getDiscoveryFallbackVersions(primaryVersion: string): string[] {
  const fromEnv = (process.env.GOOGLE_ADS_DISCOVERY_FALLBACK_VERSIONS || "")
    .split(",")
    .map((version) => version.trim())
    .filter(Boolean)

  const defaults = ["v22", "v21", "v20", "v19", "v18"]
  const ordered = [...fromEnv, ...defaults]
  const unique = Array.from(new Set(ordered))
  return unique.filter((version) => version !== primaryVersion)
}

async function requestWithVersionFallback<T>({
  path,
  accessToken,
  method,
  body,
  loginCustomerId,
  primaryVersion,
  fallbackVersions,
}: {
  path: string
  accessToken: string
  method: "GET" | "POST"
  body?: unknown
  loginCustomerId?: string | null
  primaryVersion: string
  fallbackVersions: string[]
}): Promise<T> {
  let primaryError: GoogleAdsApiError | null = null

  try {
    return await requestWithRetry<T>({
      path,
      accessToken,
      method,
      body,
      loginCustomerId,
      apiVersion: primaryVersion,
    })
  } catch (error) {
    if (!(error instanceof GoogleAdsApiError) || error.status !== 404) {
      throw error
    }
    primaryError = error
  }

  for (const fallbackVersion of fallbackVersions) {
    try {
      const payload = await requestWithRetry<T>({
        path,
        accessToken,
        method,
        body,
        loginCustomerId,
        apiVersion: fallbackVersion,
      })
      console.warn(
        `[Google Ads] ${path} succeeded with fallback API version ${fallbackVersion} after 404 on ${primaryVersion}`
      )
      return payload
    } catch (error) {
      if (!(error instanceof GoogleAdsApiError) || error.status !== 404) {
        throw error
      }
      primaryError = error
    }
  }

  throw primaryError || new Error(`Google Ads API request failed at ${path}`)
}

async function requestWithRetry<T>({
  path,
  accessToken,
  method = "GET",
  body,
  loginCustomerId,
  maxRetries = 4,
  apiVersion = GOOGLE_ADS_API_VERSION,
}: RetryRequestParams): Promise<T> {
  const url = `${getGoogleAdsBaseUrl(apiVersion)}${path}`
  const developerToken = (process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "").trim()

  if (!developerToken) {
    throw new GoogleAdsApiError({
      path,
      status: 400,
      summary: "Missing GOOGLE_ADS_DEVELOPER_TOKEN",
      errorCode: "DEVELOPER_TOKEN_MISSING",
      payload: {},
      apiVersion,
      loginCustomerId,
      hasDeveloperToken: false,
    })
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      method,
      headers: buildGoogleAdsHeaders(accessToken, loginCustomerId),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })

    const payload = await response.json().catch(() => ({}))

    if (response.ok) {
      return payload as T
    }

    if (attempt < maxRetries && isRetryableGoogleAdsError(response.status, payload)) {
      const jitterMs = Math.floor(Math.random() * 250)
      const delayMs = Math.min(12_000, 500 * 2 ** attempt + jitterMs)
      await sleep(delayMs)
      continue
    }

    const { summary, errorCode } = getGoogleAdsErrorSummary(payload)
    const normalizedLoginCustomerId = loginCustomerId ? normalizeCustomerId(loginCustomerId) : null
    console.error("[Google Ads API Request Failed]", {
      path,
      apiVersion,
      status: response.status,
      summary,
      errorCode,
      hasLoginCustomerId: Boolean(normalizedLoginCustomerId),
      loginCustomerId: normalizedLoginCustomerId,
      hasDeveloperToken: true,
    })
    throw new GoogleAdsApiError({
      path,
      status: response.status,
      summary,
      errorCode,
      payload,
      apiVersion,
      loginCustomerId,
      hasDeveloperToken: true,
    })
  }

  throw new Error("Google Ads API request exhausted retry attempts")
}

async function fetchCustomerClientRows(
  accessToken: string,
  customerId: string,
  loginCustomerId?: string | null
): Promise<CustomerClientRow[]> {
  const path = `/customers/${normalizeCustomerId(customerId)}/googleAds:searchStream`
  let streamResponse: SearchStreamChunk<CustomerClientRow>[] | null = null
  let lastError: unknown = null

  try {
    streamResponse = await requestWithVersionFallback<SearchStreamChunk<CustomerClientRow>[]>({
      path,
      method: "POST",
      accessToken,
      loginCustomerId,
      body: { query: CUSTOMER_CLIENT_DISCOVERY_QUERY },
      primaryVersion: GOOGLE_ADS_API_VERSION,
      fallbackVersions: getDiscoveryFallbackVersions(GOOGLE_ADS_API_VERSION),
    })
  } catch (error) {
    lastError = error
  }

  // For non-manager standalone roots, a login-customer-id matching the same account can fail with 403.
  // Retry once without login header to preserve standalone-account discovery.
  if (
    !streamResponse &&
    loginCustomerId &&
    normalizeCustomerId(loginCustomerId) === normalizeCustomerId(customerId) &&
    lastError instanceof GoogleAdsApiError &&
    lastError.status === 403
  ) {
    streamResponse = await requestWithVersionFallback<SearchStreamChunk<CustomerClientRow>[]>({
      path,
      method: "POST",
      accessToken,
      body: { query: CUSTOMER_CLIENT_DISCOVERY_QUERY },
      primaryVersion: GOOGLE_ADS_API_VERSION,
      fallbackVersions: getDiscoveryFallbackVersions(GOOGLE_ADS_API_VERSION),
    })
  }

  if (!streamResponse) {
    throw (lastError || new Error(`Google Ads API request failed at ${path}`))
  }

  return Array.isArray(streamResponse)
    ? streamResponse.flatMap((chunk) => chunk.results ?? [])
    : []
}

export const GoogleAdsService = {
  getOAuthClientId() {
    return getGoogleClientId()
  },

  getRedirectUri(override?: string) {
    return resolveRedirectUri(override)
  },

  getAuthUrl(options?: { redirectUri?: string; state?: string }) {
    const clientId = getGoogleClientId()
    const redirectUri = this.getRedirectUri(options?.redirectUri)
    const state = options?.state

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth")
    url.searchParams.set("client_id", clientId)
    url.searchParams.set("redirect_uri", redirectUri)
    url.searchParams.set("response_type", "code")
    url.searchParams.set("scope", GOOGLE_OAUTH_SCOPE)
    url.searchParams.set("access_type", "offline")
    url.searchParams.set("prompt", "consent")
    if (state) url.searchParams.set("state", state)
    return url.toString()
  },

  async exchangeCode(code: string, options?: { redirectUri?: string }) {
    const clientId = getGoogleClientId()
    const clientSecret = getGoogleClientSecret()
    const redirectUri = this.getRedirectUri(options?.redirectUri)

    log("info", "google/oauth", "Starting token exchange", { clientId, redirectUri })

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    })

    const tokens: any = await response.json().catch(() => ({ error: "invalid_token_response" }))

    if (!response.ok || tokens.error) {
      log("error", "google/oauth", "Token exchange failed", {
        status: response.status,
        clientId,
        redirectUri,
        hasGoogleClientSecret: Boolean(clientSecret),
        error: tokens.error,
        errorDescription: tokens.error_description,
      })
      throw new Error(
        `Token exchange failed: ${tokens.error_description || tokens.error || `HTTP ${response.status}`}`
      )
    }
    return tokens
  },

  async refreshAccessToken(refreshToken: string) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: getGoogleClientId(),
        client_secret: getGoogleClientSecret(),
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    })

    const data = await response.json()
    if (data.error) {
      throw new Error(`Google token refresh failed: ${data.error_description || data.error}`)
    }
    return data
  },

  async listAccessibleCustomers(accessToken: string): Promise<string[]> {
    const path = "/customers:listAccessibleCustomers"
    const data = await requestWithVersionFallback<{ resourceNames?: string[] }>({
      path,
      accessToken,
      method: "GET",
      primaryVersion: GOOGLE_ADS_API_VERSION,
      fallbackVersions: getDiscoveryFallbackVersions(GOOGLE_ADS_API_VERSION),
    })

    return (data.resourceNames || []).map((resourceName) =>
      normalizeCustomerId(resourceName.replace("customers/", ""))
    )
  },

  async searchStream<T>({
    accessToken,
    customerId,
    query,
    loginCustomerId,
  }: {
    accessToken: string
    customerId: string
    query: string
    loginCustomerId?: string | null
  }): Promise<SearchStreamChunk<T>[]> {
    return requestWithVersionFallback<SearchStreamChunk<T>[]>({
      path: `/customers/${normalizeCustomerId(customerId)}/googleAds:searchStream`,
      method: "POST",
      accessToken,
      loginCustomerId,
      body: { query },
      primaryVersion: GOOGLE_ADS_API_VERSION,
      fallbackVersions: getDiscoveryFallbackVersions(GOOGLE_ADS_API_VERSION),
    })
  },

  async discoverClientAccounts(accessToken: string): Promise<GoogleDiscoveredAccount[]> {
    const rootCustomerIds = await this.listAccessibleCustomers(accessToken)
    const actionableAccounts = new Map<string, GoogleDiscoveredAccount>()
    const traversalErrors: Array<{ customerId: string; error: unknown }> = []
    let usedAuthorizationFallback = false

    for (const rootCustomerId of rootCustomerIds) {
      try {
        const rootRows = await fetchCustomerClientRows(accessToken, rootCustomerId, rootCustomerId)
        const selfRow = rootRows.find((row) => normalizeCustomerId(row.customerClient?.id || "") === rootCustomerId)
        const childRows = rootRows.filter(
          (row) => normalizeCustomerId(row.customerClient?.id || "") !== rootCustomerId
        )

        if (childRows.length === 0) {
          if (selfRow && selfRow.customerClient?.manager === false) {
            actionableAccounts.set(rootCustomerId, {
              externalId: rootCustomerId,
              name: selfRow.customerClient?.descriptiveName || `Google Ads ${rootCustomerId}`,
              currency: "USD",
              managerCustomerId: null,
              isManager: false,
              level: selfRow.customerClient?.level,
              status: selfRow.customerClient?.status,
            })
          }
          continue
        }

        const visitedManagers = new Set<string>()

        const walkHierarchy = async (managerCustomerId: string): Promise<void> => {
          const normalizedManagerId = normalizeCustomerId(managerCustomerId)
          if (visitedManagers.has(normalizedManagerId)) return
          visitedManagers.add(normalizedManagerId)

          const rows = await fetchCustomerClientRows(accessToken, normalizedManagerId, rootCustomerId)

          for (const row of rows) {
            const customerClient = row.customerClient
            const childId = normalizeCustomerId(customerClient?.id || "")
            if (!childId || childId === normalizedManagerId) continue

            if (customerClient?.manager) {
              await walkHierarchy(childId)
              continue
            }

            actionableAccounts.set(childId, {
              externalId: childId,
              name: customerClient?.descriptiveName || `Google Ads ${childId}`,
              currency: "USD",
              managerCustomerId: rootCustomerId,
              isManager: false,
              level: customerClient?.level,
              status: customerClient?.status,
            })
          }
        }

        await walkHierarchy(rootCustomerId)
      } catch (rootError) {
        if (isAuthorizationDiscoveryError(rootError)) {
          console.warn(`[Google Ads Discovery] Authorization-limited root traversal for ${rootCustomerId}:`, rootError)
          usedAuthorizationFallback = true
          actionableAccounts.set(rootCustomerId, {
            externalId: rootCustomerId,
            name: `Google Ads ${rootCustomerId}`,
            currency: "USD",
            managerCustomerId: null,
            isManager: false,
            status: "ENABLED",
            discoveryFallback: "AUTHORIZATION",
          })
          continue
        }
        console.warn(`[Google Ads Discovery] Failed root traversal for ${rootCustomerId}:`, rootError)
        traversalErrors.push({ customerId: rootCustomerId, error: rootError })
      }
    }

    if (usedAuthorizationFallback) {
      console.warn("[Google Ads Discovery] Authorization fallback enabled for one or more roots", {
        roots: rootCustomerIds,
      })
    }

    if (actionableAccounts.size === 0 && traversalErrors.length > 0) {
      const firstError = traversalErrors[0]?.error
      if (firstError instanceof GoogleAdsApiError) {
        throw firstError
      }
      throw new Error(
        `Google Ads discovery failed for ${traversalErrors.length} account root(s) with no actionable clients found`
      )
    }

    return Array.from(actionableAccounts.values())
  },

  async updateCampaignStatus({
    accessToken,
    customerId,
    campaignId,
    status,
    loginCustomerId,
  }: {
    accessToken: string
    customerId: string
    campaignId: string
    status: "PAUSED" | "ENABLED"
    loginCustomerId?: string | null
  }) {
    return requestWithRetry({
      path: `/customers/${normalizeCustomerId(customerId)}/campaigns:mutate`,
      accessToken,
      method: "POST",
      loginCustomerId,
      body: {
        operations: [
          {
            update: {
              resourceName: `customers/${normalizeCustomerId(customerId)}/campaigns/${normalizeCustomerId(
                campaignId
              )}`,
              status,
            },
            updateMask: "status",
          },
        ],
      },
    })
  },

  async updateAdGroupStatus({
    accessToken,
    customerId,
    adGroupId,
    status,
    loginCustomerId,
  }: {
    accessToken: string
    customerId: string
    adGroupId: string
    status: "PAUSED" | "ENABLED"
    loginCustomerId?: string | null
  }) {
    return requestWithRetry({
      path: `/customers/${normalizeCustomerId(customerId)}/adGroups:mutate`,
      accessToken,
      method: "POST",
      loginCustomerId,
      body: {
        operations: [
          {
            update: {
              resourceName: `customers/${normalizeCustomerId(customerId)}/adGroups/${normalizeCustomerId(adGroupId)}`,
              status,
            },
            updateMask: "status",
          },
        ],
      },
    })
  },

  async updateCampaignBudget({
    accessToken,
    customerId,
    campaignBudgetResourceName,
    amountMicros,
    loginCustomerId,
  }: {
    accessToken: string
    customerId: string
    campaignBudgetResourceName: string
    amountMicros: number
    loginCustomerId?: string | null
  }) {
    const resourceName = campaignBudgetResourceName.includes("customers/")
      ? campaignBudgetResourceName
      : `customers/${normalizeCustomerId(customerId)}/campaignBudgets/${normalizeCustomerId(campaignBudgetResourceName)}`

    return requestWithRetry({
      path: `/customers/${normalizeCustomerId(customerId)}/campaignBudgets:mutate`,
      accessToken,
      method: "POST",
      loginCustomerId,
      body: {
        operations: [
          {
            update: {
              resourceName,
              amountMicros,
            },
            updateMask: "amount_micros",
          },
        ],
      },
    })
  },
}
