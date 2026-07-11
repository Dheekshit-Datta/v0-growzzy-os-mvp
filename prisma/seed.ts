import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

type SeedCampaign = {
  name: string
  status: string
  budget: number
  spend: number
  impressions: number
  clicks: number
  conversions: number
  ctr: number
  cpc: number
  roas: number
}

const CAMPAIGNS: SeedCampaign[] = [
  {
    name: "Summer Sale 2025",
    status: "ACTIVE",
    budget: 5000,
    spend: 3842.5,
    impressions: 284750,
    clicks: 9823,
    conversions: 312,
    ctr: 3.45,
    cpc: 0.39,
    roas: 4.2,
  },
  {
    name: "Brand Awareness Q2",
    status: "ACTIVE",
    budget: 3000,
    spend: 2910.0,
    impressions: 412000,
    clicks: 6180,
    conversions: 89,
    ctr: 1.5,
    cpc: 0.47,
    roas: 2.8,
  },
  {
    name: "Retargeting — Website Visitors",
    status: "ACTIVE",
    budget: 2000,
    spend: 1654.2,
    impressions: 98400,
    clicks: 7234,
    conversions: 428,
    ctr: 7.35,
    cpc: 0.23,
    roas: 6.7,
  },
  {
    name: "Lead Gen — Coaches",
    status: "PAUSED",
    budget: 4000,
    spend: 3200.0,
    impressions: 156000,
    clicks: 4290,
    conversions: 201,
    ctr: 2.75,
    cpc: 0.75,
    roas: 3.9,
  },
  {
    name: "Product Launch — Oct",
    status: "ACTIVE",
    budget: 8000,
    spend: 6120.0,
    impressions: 520000,
    clicks: 14820,
    conversions: 634,
    ctr: 2.85,
    cpc: 0.41,
    roas: 5.1,
  },
  {
    name: "Competitor Conquest",
    status: "ACTIVE",
    budget: 1500,
    spend: 1498.0,
    impressions: 67200,
    clicks: 3890,
    conversions: 156,
    ctr: 5.79,
    cpc: 0.38,
    roas: 4.8,
  },
]

const LEADS = [
  { name: "Sarah Johnson", company: "TechCorp Ltd", status: "Qualified", source: "Google Ads", estimatedValue: 4200, createdAt: "2026-04-18" },
  { name: "Mike Chen", company: "GrowthCo", status: "New", source: "Meta Ads", estimatedValue: 2800, createdAt: "2026-04-19" },
  { name: "Priya Patel", company: "ScaleUp Inc", status: "Contacted", source: "Google Ads", estimatedValue: 6500, createdAt: "2026-04-17" },
  { name: "Emma Davis", company: "MarketPros", status: "Converted", source: "Google Ads", estimatedValue: 8900, createdAt: "2026-04-15" },
  { name: "Raj Kumar", company: "AdVenture", status: "New", source: "Meta Ads", estimatedValue: 2200, createdAt: "2026-04-19" },
  { name: "Lisa Park", company: "BrandBoost", status: "Contacted", source: "Google Ads", estimatedValue: 5400, createdAt: "2026-04-14" },
]

async function main() {
  const firstUser = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
  })

  if (!firstUser) {
    throw new Error("No users found. Create/login a user before running seed.")
  }

  const workspace = await prisma.workspace.upsert({
    where: { slug: `default-${firstUser.id.slice(-6).toLowerCase()}` },
    update: { name: firstUser.name ? `${firstUser.name}'s Workspace` : "Growzzy Workspace" },
    create: {
      name: firstUser.name ? `${firstUser.name}'s Workspace` : "Growzzy Workspace",
      slug: `default-${firstUser.id.slice(-6).toLowerCase()}`,
      ownerId: firstUser.id,
      members: { create: { userId: firstUser.id, role: "ADMIN" } },
    },
  })

  const existingIntegration = await prisma.integration.findFirst({
    where: { userId: firstUser.id, workspaceId: workspace.id, platform: "GOOGLE" },
  })
  const integration = existingIntegration
    ? await prisma.integration.update({
        where: { id: existingIntegration.id },
        data: {
      workspaceId: workspace.id,
      hasAdsAccount: true,
      status: "ACTIVE",
      selectedAdAccountId: "9876543210",
      selectedAdAccountName: "Markitx Growth Account",
      lastSyncAt: new Date(),
      lastSyncStatus: "SYNCED",
      lastSyncError: null,
        },
      })
    : await prisma.integration.create({
        data: {
      userId: firstUser.id,
      workspaceId: workspace.id,
      platform: "GOOGLE",
      hasAdsAccount: true,
      status: "ACTIVE",
      selectedAdAccountId: "9876543210",
      selectedAdAccountName: "Markitx Growth Account",
      lastSyncAt: new Date(),
      lastSyncStatus: "SYNCED",
        },
      })

  const adAccount = await prisma.adAccount.upsert({
    where: {
      integrationId_externalId: {
        integrationId: integration.id,
        externalId: "9876543210",
      },
    },
    update: {
      userId: firstUser.id,
      name: "Markitx Growth Account",
      platform: "GOOGLE",
      isPrimary: true,
      syncStatus: "SYNCED",
      lastSyncedAt: new Date(),
      currencyCode: "USD",
      isManager: false,
      managerCustomerId: null,
      workspaceId: workspace.id,
    },
    create: {
      integrationId: integration.id,
      workspaceId: workspace.id,
      userId: firstUser.id,
      platform: "GOOGLE",
      externalId: "9876543210",
      name: "Markitx Growth Account",
      currencyCode: "USD",
      isPrimary: true,
      syncStatus: "SYNCED",
      lastSyncedAt: new Date(),
      isManager: false,
      managerCustomerId: null,
    },
  })

  for (let i = 0; i < CAMPAIGNS.length; i += 1) {
    const campaign = CAMPAIGNS[i]
    const externalId = `google-seed-${i + 1}`
    const revenue = Number((campaign.spend * campaign.roas).toFixed(2))
    await prisma.campaign.upsert({
      where: {
        integrationId_externalId: {
          integrationId: integration.id,
          externalId,
        },
      },
      update: {
        integrationId: integration.id,
        workspaceId: workspace.id,
        userId: firstUser.id,
        adAccountId: adAccount.externalId,
        name: campaign.name,
        status: campaign.status,
        objective: "CONVERSIONS",
        budgetAmount: campaign.budget,
        budgetCurrency: "USD",
        spend: campaign.spend,
        impressions: campaign.impressions,
        clicks: campaign.clicks,
        conversions: campaign.conversions,
        ctr: campaign.ctr,
        cpc: campaign.cpc,
        roas: campaign.roas,
        revenue,
        syncedAt: new Date(),
        lastSeenAt: new Date(),
      },
      create: {
        integrationId: integration.id,
        workspaceId: workspace.id,
        userId: firstUser.id,
        platform: "GOOGLE",
        externalId,
        adAccountId: adAccount.externalId,
        name: campaign.name,
        status: campaign.status,
        objective: "CONVERSIONS",
        budgetAmount: campaign.budget,
        budgetCurrency: "USD",
        spend: campaign.spend,
        impressions: campaign.impressions,
        clicks: campaign.clicks,
        conversions: campaign.conversions,
        ctr: campaign.ctr,
        cpc: campaign.cpc,
        roas: campaign.roas,
        revenue,
        syncedAt: new Date(),
      },
    })
  }

  for (const lead of LEADS) {
    const email = `${lead.name.toLowerCase().replace(/\s+/g, ".")}@example.com`
    const existingLead = await prisma.lead.findFirst({
      where: {
        userId: firstUser.id,
        email,
      },
      select: { id: true },
    })
    const leadData = {
      userId: firstUser.id,
      workspaceId: workspace.id,
      name: lead.name,
      email,
      company: lead.company,
      status: lead.status.toLowerCase(),
      source: lead.source,
      estimatedValue: lead.estimatedValue,
      createdAt: new Date(`${lead.createdAt}T10:00:00.000Z`),
    }
    if (existingLead) {
      await prisma.lead.update({
        where: { id: existingLead.id },
        data: leadData,
      })
    } else {
      await prisma.lead.create({
        data: leadData,
      })
    }
  }

  console.log("Seed complete for user:", firstUser.email, firstUser.id)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
