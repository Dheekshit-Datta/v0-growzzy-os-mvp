type GoogleObjective = "SEARCH" | "DISPLAY" | "VIDEO" | "PERFORMANCE_MAX" | "DEMAND_GEN" | "SHOPPING" | "MULTI_CHANNEL"
type GoogleBiddingStrategy = "MAXIMIZE_CONVERSIONS" | "MAXIMIZE_CLICKS" | "TARGET_CPA" | "TARGET_ROAS"

export type CreateCampaignParams = {
  accessToken: string
  customerId: string
  name: string
  dailyBudgetMicros: number
  objective: GoogleObjective
  biddingStrategy?: GoogleBiddingStrategy
  targetCpaMicros?: number | null
  targetRoas?: number | null
  status?: "PAUSED" | "ENABLED"
  loginCustomerId?: string | null
  locations?: string[]
  languages?: string[]
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

function googleErrorMessage(payload: any, fallback: string) {
  const base = payload?.error?.message || fallback
  const details = payload?.error?.details
    ?.flatMap((detail: any) => detail?.errors || [])
    ?.map((error: any) => {
      const path = error?.location?.fieldPathElements?.map((field: any) => field?.fieldName).filter(Boolean).join(".")
      const code = Object.values(error?.errorCode || {})[0]
      return [path, code, error?.message].filter(Boolean).join(": ")
    })
    ?.filter(Boolean)
    ?.join(" | ")
  return details ? `${base} — ${details}` : base
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
  if (!response.ok) throw new Error(googleErrorMessage(payload, `Google Ads ${resource} mutate failed`))
  return payload as T
}

function mapObjectiveToChannelType(objective: string): GoogleObjective {
  const normalized = (objective || "").toUpperCase()
  if (normalized.includes("PMAX") || normalized.includes("PERFORMANCE_MAX")) return "PERFORMANCE_MAX"
  if (normalized.includes("VIDEO")) return "VIDEO"
  if (normalized.includes("DISPLAY")) return "DISPLAY"
  if (normalized.includes("SHOPPING")) return "SHOPPING"
  if (normalized.includes("DEMAND_GEN") || normalized.includes("DEMANDGEN")) return "DEMAND_GEN"
  if (normalized.includes("APP")) return "MULTI_CHANNEL"
  return "SEARCH"
}

function googleBiddingConfig(strategy: GoogleBiddingStrategy, targetCpaMicros?: number | null, targetRoas?: number | null) {
  if (strategy === "MAXIMIZE_CLICKS") return { targetSpend: {} }
  if (strategy === "TARGET_CPA") {
    if (!targetCpaMicros || targetCpaMicros <= 0) throw new Error("TARGET_CPA requires a positive target CPA")
    return { targetCpa: { targetCpaMicros } }
  }
  if (strategy === "TARGET_ROAS") {
    if (!targetRoas || targetRoas <= 0) throw new Error("TARGET_ROAS requires a positive target ROAS")
    return { targetRoas: { targetRoas } }
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
    throw new Error(googleErrorMessage(payload, "Failed to create Google campaign budget"))
  }
  const resourceName = payload?.results?.[0]?.resourceName
  if (!resourceName) throw new Error("Google campaign budget resource name missing")
  return resourceName
}

export async function applyGoogleCampaignCriteria({
  accessToken,
  customerId,
  campaignResourceName,
  locations = ["United States"],
  languages = ["English"],
  loginCustomerId,
}: {
  accessToken: string
  customerId: string
  campaignResourceName: string
  locations?: string[]
  languages?: string[]
  loginCustomerId?: string | null
}) {
  const operations: any[] = []

  const geoMap: Record<string, string> = {
    "united states": "geoTargetConstants/2840",
    "us": "geoTargetConstants/2840",
    "usa": "geoTargetConstants/2840",
    "india": "geoTargetConstants/2356",
    "in": "geoTargetConstants/2356",
    "united kingdom": "geoTargetConstants/2826",
    "uk": "geoTargetConstants/2826",
    "canada": "geoTargetConstants/2124",
    "australia": "geoTargetConstants/2036",
  }

  const locList = Array.isArray(locations) && locations.length ? locations : ["United States"]
  locList.forEach((loc) => {
    const geoId = geoMap[String(loc).toLowerCase().trim()] || "geoTargetConstants/2840"
    operations.push({
      create: {
        campaign: campaignResourceName,
        location: { geoTargetConstant: geoId },
      },
    })
  })

  operations.push({
    create: {
      campaign: campaignResourceName,
      language: { languageConstant: "languageConstants/1000" },
    },
  })

  try {
    await fetch(
      `https://googleads.googleapis.com/${googleAdsApiVersion()}/customers/${normalizeId(customerId)}/campaignCriteria:mutate`,
      {
        method: "POST",
        headers: googleHeaders(accessToken, loginCustomerId),
        body: JSON.stringify({ operations }),
      }
    )
  } catch (err) {
    console.warn("Failed to set Google campaign criteria:", err)
  }
}

export async function createGoogleAdsCampaign({
  accessToken,
  customerId,
  name,
  dailyBudgetMicros,
  objective,
  biddingStrategy = "MAXIMIZE_CONVERSIONS",
  targetCpaMicros,
  targetRoas,
  status = "PAUSED",
  locations = ["United States"],
  languages = ["English"],
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
          containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
          ...googleBiddingConfig(biddingStrategy, targetCpaMicros, targetRoas),
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
    throw new Error(googleErrorMessage(payload, "Failed to create Google Ads campaign"))
  }

  const resourceName = payload?.results?.[0]?.resourceName
  const campaignId = resourceName ? String(resourceName).split("/").pop() : null
  if (!campaignId || !resourceName) throw new Error("Google campaign resource ID missing")

  await applyGoogleCampaignCriteria({
    accessToken,
    customerId,
    campaignResourceName: resourceName,
    locations,
    languages,
    loginCustomerId,
  })

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
  const campaignResource = campaignId.includes("customers/")
    ? campaignId
    : `customers/${normalizeId(customerId)}/campaigns/${normalizeId(campaignId)}`
  const body = {
    operations: [
      {
        create: {
          name,
          campaign: campaignResource,
          status: "ENABLED",
          ...(defaultBidMicros && defaultBidMicros > 0 ? { cpcBidMicros: defaultBidMicros } : {}),
        },
      },
    ],
  }
  const payload = await mutateGoogle<any>({
    accessToken,
    customerId,
    loginCustomerId,
    resource: "adGroups",
    body,
  })
  const resourceName = payload?.results?.[0]?.resourceName
  const adGroupId = resourceName ? String(resourceName).split("/").pop() : null
  if (!adGroupId) throw new Error("Google ad group resource ID missing")
  return { adGroupId, resourceName }
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
  keywords: Array<{ text: string; matchType: "BROAD" | "PHRASE" | "EXACT"; isNegative?: boolean; bid?: number }>
  loginCustomerId?: string | null
}) {
  const groupResource = adGroupId.includes("customers/")
    ? adGroupId
    : `customers/${normalizeId(customerId)}/adGroups/${normalizeId(adGroupId)}`

  const operations = keywords
    .filter((k) => k.text && k.text.trim())
    .map((k) => ({
      create: {
        adGroup: groupResource,
        status: "ENABLED",
        keyword: {
          text: k.text.trim(),
          matchType: k.matchType || "PHRASE",
        },
        ...(k.bid && k.bid > 0 ? { cpcBidMicros: Math.round(k.bid * 1_000_000) } : {}),
      },
    }))

  if (!operations.length) return { count: 0 }

  return mutateGoogle<any>({
    accessToken,
    customerId,
    loginCustomerId,
    resource: "adGroupCriteria",
    body: { operations },
  })
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
  const groupResource = adGroupId.includes("customers/")
    ? adGroupId
    : `customers/${normalizeId(customerId)}/adGroups/${normalizeId(adGroupId)}`

  const validHeadlines = headlines
    .filter((h) => h.text && h.text.trim())
    .slice(0, 15)
    .map((h) => ({
      text: h.text.trim().slice(0, 30),
      ...(h.pinPosition ? { pinnedField: `HEADLINE_${h.pinPosition}` } : {}),
    }))

  const validDescriptions = descriptions
    .filter((d) => d.text && d.text.trim())
    .slice(0, 4)
    .map((d) => ({
      text: d.text.trim().slice(0, 90),
    }))

  if (validHeadlines.length < 3) throw new Error("At least 3 valid headlines (<=30 chars) required for RSA ad")
  if (validDescriptions.length < 1) throw new Error("At least 1 valid description (<=90 chars) required for RSA ad")

  const body = {
    operations: [
      {
        create: {
          adGroup: groupResource,
          status: "ENABLED",
          ad: {
            finalUrls: [finalUrl],
            ...(displayPath1 ? { path1: displayPath1.slice(0, 15) } : {}),
            ...(displayPath2 ? { path2: displayPath2.slice(0, 15) } : {}),
            responsiveSearchAd: {
              headlines: validHeadlines,
              descriptions: validDescriptions,
            },
          },
        },
      },
    ],
  }

  return mutateGoogle<any>({
    accessToken,
    customerId,
    loginCustomerId,
    resource: "adGroupAd",
    body,
  })
}
