export interface MetaAdAccount {
  id: string
  name: string
  currency: string
}

export interface MetaCampaignMetrics {
  campaignId: string
  name: string
  spend: number
  impressions: number
  clicks: number
  conversions: number
  ctr: number
  cpc: number
  cpm: number
  roas: number
}

const META_API_VERSION = "v18.0"

export async function getMetaAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  try {
    console.log("[v0] Fetching Meta ad accounts...")
    const response = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/me/adaccounts?fields=id,name,currency&access_token=${accessToken}`,
    )

    if (!response.ok) {
      console.log("[v0] Meta API error:", response.status)
      throw new Error(`Meta API error: ${response.status}`)
    }

    const data = await response.json()
    console.log("[v0] Meta accounts fetched:", data.data.length)
    return data.data
  } catch (error) {
    console.log("[v0] Error fetching Meta accounts:", error)
    throw error
  }
}

export async function getMetaCampaigns(accessToken: string, accountId: string): Promise<MetaCampaignMetrics[]> {
  try {
    console.log("[v0] Fetching Meta campaigns for account:", accountId)
    const response = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${accountId}/campaigns?fields=id,name,insights.date_start(2024-01-01).date_stop(today){spend,impressions,clicks,conversions,ctr,cpc,cpm}&access_token=${accessToken}`,
    )

    if (!response.ok) {
      throw new Error(`Meta API error: ${response.status}`)
    }

    const data = await response.json()
    const campaigns: MetaCampaignMetrics[] = []

    if (data.data) {
      for (const campaign of data.data) {
        const insights = campaign.insights?.data?.[0] || {}
        const spend = Number.parseFloat(insights.spend || "0")
        const conversions = Number.parseFloat(insights.conversions || "0")
        const revenue = conversions * 50 // Estimate $50 per conversion

        campaigns.push({
          campaignId: campaign.id,
          name: campaign.name,
          spend,
          impressions: Number.parseInt(insights.impressions || "0"),
          clicks: Number.parseInt(insights.clicks || "0"),
          conversions,
          ctr: Number.parseFloat(insights.ctr || "0"),
          cpc: Number.parseFloat(insights.cpc || "0"),
          cpm: Number.parseFloat(insights.cpm || "0"),
          roas: spend > 0 ? revenue / spend : 0,
        })
      }
    }

    console.log("[v0] Fetched", campaigns.length, "campaigns")
    return campaigns
  } catch (error) {
    console.log("[v0] Error fetching Meta campaigns:", error)
    throw error
  }
}

export async function createMetaCampaign(
  accessToken: string,
  accountId: string,
  campaignData: {
    name: string
    objective: string
    budget: number
  },
): Promise<{ campaignId: string; success: boolean }> {
  try {
    console.log("[v0] Creating Meta campaign...")
    const response = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${accountId}/campaigns`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: campaignData.name,
        objective: campaignData.objective,
        status: "PAUSED",
        special_ad_categories: [],
        access_token: accessToken,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to create campaign: ${response.status}`)
    }

    const data = await response.json()
    console.log("[v0] Campaign created:", data.id)
    return {
      campaignId: data.id,
      success: true,
    }
  } catch (error) {
    console.log("[v0] Error creating Meta campaign:", error)
    throw error
  }
}
