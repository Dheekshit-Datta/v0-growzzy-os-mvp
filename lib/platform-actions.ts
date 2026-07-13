type GoogleObjective = "SEARCH" | "DISPLAY" | "VIDEO"
type GoogleBiddingStrategy = "MAXIMIZE_CONVERSIONS" | "MAXIMIZE_CLICKS" | "TARGET_CPA"

export type CreateCampaignParams = {
  accessToken: string
  customerId: string
  name: string
  dailyBudgetMicros: number
  objective: GoogleObjective
  biddingStrategy?: GoogleBiddingStrategy
  targetCpaMicros?: number | null
  status?: "PAUSED" | "ENABLED"
  loginCustomerId?: string | null
}

type CreateMetaCampaignParams = {
  accessToken: string
  adAccountId: string
  name: string
  objective: string
  status?: string
}

function normalizeId(value: string) {
  return String(value).replace(/\D/g, "")
}

function googleHeaders(accessToken: string, loginCustomerId?: string | null) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
    "Content-Type": "application/json",
  }
  if (loginCustomerId) headers["login-customer-id"] = normalizeId(loginCustomerId)
  return headers
}

function googleAdsApiVersion() {
  return process.env.GOOGLE_ADS_API_VERSION || "v18"
}

async function mutateGoogle<T>({
  accessToken,
  customerId,
  loginCustomerId,
  resource,
  body,
}: {
  accessToken: string
  customerId: string
  loginCustomerId?: string | null
  resource: string
  body: unknown
}): Promise<T> {
  const response = await fetch(`https://googleads.googleapis.com/${googleAdsApiVersion()}/customers/${normalizeId(customerId)}/${resource}:mutate`, {
    method: "POST",
    headers: googleHeaders(accessToken, loginCustomerId),
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error?.message || `Google Ads ${resource} mutate failed`)
  return payload as T
}

function mapObjectiveToChannelType(objective: string): GoogleObjective {
  const normalized = (objective || "").toUpperCase()
  if (normalized.includes("VIDEO")) return "VIDEO"
  if (normalized.includes("DISPLAY")) return "DISPLAY"
  return "SEARCH"
}

function googleBiddingConfig(strategy: GoogleBiddingStrategy, targetCpaMicros?: number | null) {
  if (strategy === "MAXIMIZE_CLICKS") return { targetSpend: {} }
  if (strategy === "TARGET_CPA") {
    if (!targetCpaMicros || targetCpaMicros <= 0) throw new Error("TARGET_CPA requires a positive target CPA")
    return { targetCpa: { targetCpaMicros } }
  }
  return { maximizeConversions: {} }
}

async function createGoogleCampaignBudget({
  accessToken,
  customerId,
  dailyBudgetMicros,
  loginCustomerId,
}: {
  accessToken: string
  customerId: string
  dailyBudgetMicros: number
  loginCustomerId?: string | null
}) {
  const body = {
    operations: [
      {
        create: {
          name: `Growzzy Budget ${Date.now()}`,
          amountMicros: dailyBudgetMicros,
          deliveryMethod: "STANDARD",
          explicitlyShared: false,
        },
      },
    ],
  }
  const response = await fetch(
    `https://googleads.googleapis.com/${googleAdsApiVersion()}/customers/${normalizeId(customerId)}/campaignBudgets:mutate`,
    { method: "POST", headers: googleHeaders(accessToken, loginCustomerId), body: JSON.stringify(body) }
  )
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Failed to create Google campaign budget")
  }
  const resourceName = payload?.results?.[0]?.resourceName
  if (!resourceName) throw new Error("Google campaign budget resource name missing")
  return resourceName
}

export async function createGoogleAdsCampaign({
  accessToken,
  customerId,
  name,
  dailyBudgetMicros,
  objective,
  biddingStrategy = "MAXIMIZE_CONVERSIONS",
  targetCpaMicros,
  status = "PAUSED",
  loginCustomerId,
}: CreateCampaignParams) {
  const budgetResource = await createGoogleCampaignBudget({
    accessToken,
    customerId,
    dailyBudgetMicros,
    loginCustomerId,
  })

  const body = {
    operations: [
      {
        create: {
          name,
          status,
          campaignBudget: budgetResource,
          advertisingChannelType: mapObjectiveToChannelType(objective),
          ...googleBiddingConfig(biddingStrategy, targetCpaMicros),
        },
      },
    ],
  }

  const response = await fetch(
    `https://googleads.googleapis.com/${googleAdsApiVersion()}/customers/${normalizeId(customerId)}/campaigns:mutate`,
    { method: "POST", headers: googleHeaders(accessToken, loginCustomerId), body: JSON.stringify(body) }
  )
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Failed to create Google Ads campaign")
  }

  const resourceName = payload?.results?.[0]?.resourceName
  const campaignId = resourceName ? String(resourceName).split("/").pop() : null
  if (!campaignId || !resourceName) throw new Error("Google campaign resource ID missing")
  return { campaignId, resourceName, budgetResourceName: budgetResource }
}

export async function updateGoogleCampaignStatus({
  accessToken,
  customerId,
  campaignId,
  status,
  loginCustomerId,
}: {
  accessToken: string
  customerId: string
  campaignId: string
  status: "ENABLED" | "PAUSED" | "REMOVED"
  loginCustomerId?: string | null
}) {
  const campaignResource = campaignId.includes("customers/")
    ? campaignId
    : `customers/${normalizeId(customerId)}/campaigns/${normalizeId(campaignId)}`
  return mutateGoogle<any>({
    accessToken,
    customerId,
    loginCustomerId,
    resource: "campaigns",
    body: {
      operations: [
        {
          update: {
            resourceName: campaignResource,
            status,
          },
          updateMask: "status",
        },
      ],
    },
  })
}

export async function updateMetaCampaignStatus({
  accessToken,
  campaignId,
  status,
}: {
  accessToken: string
  campaignId: string
  status: "ACTIVE" | "PAUSED" | "ARCHIVED"
}) {
  const params = new URLSearchParams({ status, access_token: accessToken })
  const response = await fetch(`https://graph.facebook.com/v19.0/${campaignId}`, { method: "POST", body: params })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error?.message || "Failed to update Meta campaign status")
  return payload
}

export async function createGoogleAdGroup({
  accessToken,
  customerId,
  campaignId,
  name,
  defaultBidMicros,
  loginCustomerId,
}: {
  accessToken: string
  customerId: string
  campaignId: string
  name: string
  defaultBidMicros?: number | null
  loginCustomerId?: string | null
}) {
  const body = {
    operations: [
      {
        create: {
          name,
          campaign: campaignId.includes("customers/")
            ? campaignId
            : `customers/${normalizeId(customerId)}/campaigns/${normalizeId(campaignId)}`,
          status: "ENABLED",
          ...(defaultBidMicros ? { cpcBidMicros: defaultBidMicros } : {}),
        },
      },
    ],
  }
  const payload: any = await mutateGoogle({
    accessToken,
    customerId,
    loginCustomerId,
    resource: "adGroups",
    body,
  })
  const resourceName = payload?.results?.[0]?.resourceName
  return { adGroupId: String(resourceName || "").split("/").pop() || "", resourceName }
}

export async function createGoogleKeywords({
  accessToken,
  customerId,
  adGroupId,
  keywords,
  loginCustomerId,
}: {
  accessToken: string
  customerId: string
  adGroupId: string
  keywords: Array<{ text: string; matchType: string; isNegative?: boolean; bid?: number | null }>
  loginCustomerId?: string | null
}) {
  const adGroupResource = adGroupId.includes("customers/")
    ? adGroupId
    : `customers/${normalizeId(customerId)}/adGroups/${normalizeId(adGroupId)}`
  const body = {
    operations: keywords.map((keyword) => ({
      create: {
        adGroup: adGroupResource,
        status: "ENABLED",
        negative: !!keyword.isNegative,
        keyword: {
          text: keyword.text,
          matchType: keyword.matchType,
        },
        ...(keyword.bid ? { cpcBidMicros: Math.round(keyword.bid * 1_000_000) } : {}),
      },
    })),
  }
  return mutateGoogle<any>({ accessToken, customerId, loginCustomerId, resource: "adGroupCriteria", body })
}

export async function createGoogleResponsiveSearchAd({
  accessToken,
  customerId,
  adGroupId,
  headlines,
  descriptions,
  finalUrl,
  displayPath1,
  displayPath2,
  loginCustomerId,
}: {
  accessToken: string
  customerId: string
  adGroupId: string
  headlines: Array<{ text: string; pinPosition?: number | null }>
  descriptions: Array<{ text: string }>
  finalUrl: string
  displayPath1?: string | null
  displayPath2?: string | null
  loginCustomerId?: string | null
}) {
  const adGroupResource = adGroupId.includes("customers/")
    ? adGroupId
    : `customers/${normalizeId(customerId)}/adGroups/${normalizeId(adGroupId)}`
  const pinnedMap: Record<number, string> = {
    1: "HEADLINE_1",
    2: "HEADLINE_2",
    3: "HEADLINE_3",
  }
  const body = {
    operations: [
      {
        create: {
          adGroup: adGroupResource,
          status: "ENABLED",
          ad: {
            finalUrls: [finalUrl],
            responsiveSearchAd: {
              headlines: headlines.map((headline) => ({
                text: headline.text,
                ...(headline.pinPosition ? { pinnedField: pinnedMap[headline.pinPosition] } : {}),
              })),
              descriptions: descriptions.map((description) => ({ text: description.text })),
              ...(displayPath1 ? { path1: displayPath1 } : {}),
              ...(displayPath2 ? { path2: displayPath2 } : {}),
            },
          },
        },
      },
    ],
  }
  const payload: any = await mutateGoogle({ accessToken, customerId, loginCustomerId, resource: "adGroupAds", body })
  const resourceName = payload?.results?.[0]?.resourceName
  return { adId: String(resourceName || "").split("~").pop() || "", resourceName }
}

export async function createMetaCampaign({
  accessToken,
  adAccountId,
  name,
  objective,
  status = "PAUSED",
}: CreateMetaCampaignParams) {
  const normalizedAdAccountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId.replace(/^act_/, "")}`
  const endpoint = `https://graph.facebook.com/v19.0/${normalizedAdAccountId}/campaigns`
  const params = new URLSearchParams({
    name,
    objective,
    status,
    special_ad_categories: "[]",
    access_token: accessToken,
  })
  const response = await fetch(endpoint, { method: "POST", body: params })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error?.message || "Failed to create Meta campaign")
  return {
    campaignId: String(payload?.id || ""),
    resourceName: String(payload?.id || ""),
  }
}
