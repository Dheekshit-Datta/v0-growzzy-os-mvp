"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Shell } from "@/components/dashboard-v2/shell"
import { ArrowLeft, Loader2, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

type MetricDaily = {
  metricDate: string
  impressions: number
  clicks: number
  spend: number
  conversions: number
  revenue: number
}

type Keyword = { id: string; text: string; matchType: string; isNegative: boolean; status: string }
type AdItem = { id: string; headlines: string[]; descriptions: string[]; finalUrl: string }
type AdGroup = { id: string; name: string; theme: string | null; status: string; keywords: Keyword[]; ads: AdItem[] }

type CampaignDetail = {
  id: string
  name: string
  status: string
  platform: string
  objective: string | null
  budgetAmount: number | null
  dailyBudget: number | null
  budgetCurrency: string | null
  externalId: string
  totalSpend: number
  totalRevenue: number
  integration: { id: string; platform: string; accountName: string | null; selectedAdAccountName: string | null } | null
  metricsDaily: MetricDaily[]
  adGroups: AdGroup[]
  creatives: unknown[]
}

function money(n: number | null | undefined) {
  return "$" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function statusPill(status: string) {
  const s = (status || "").toUpperCase()
  if (s.includes("LIVE") || s === "ENABLED" || s === "ACTIVE") return { label: "Live", cls: "bg-[#E6F4EC] text-[#2E9E5B]" }
  if (s.includes("PAUSE")) return { label: "Paused", cls: "bg-[#FBF0DA] text-[#B8892B]" }
  if (s.includes("REJECT") || s.includes("FAIL")) return { label: "Rejected", cls: "bg-[#FBE7E5] text-[#D3564C]" }
  return { label: status || "Draft", cls: "bg-[#EFEEEC] text-[#83887F]" }
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn("rounded-[14px] p-5", className)}
      style={{ background: "linear-gradient(145deg, #ffffff 0%, #f8f9fb 100%)", boxShadow: "0 1px 0 rgba(255,255,255,0.9) inset, 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.06)" }}
    >
      {children}
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider">{label}</p>
      <p className="text-[20px] font-semibold text-[#111827] mt-1">{value}</p>
    </div>
  )
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)

  useEffect(() => {
    if (!params?.id) return
    fetch(`/api/campaigns/${params.id}`, { cache: "no-store" })
      .then(async (r) => {
        const json = await r.json()
        if (!r.ok) throw new Error(json?.error || "Campaign not found")
        setCampaign(json.campaign)
      })
      .catch((e) => setError(e?.message || "Failed to load campaign"))
      .finally(() => setLoading(false))
  }, [params?.id])

  const totalClicks = campaign?.metricsDaily.reduce((sum, m) => sum + (m.clicks || 0), 0) ?? 0
  const totalConversions = campaign?.metricsDaily.reduce((sum, m) => sum + (m.conversions || 0), 0) ?? 0
  const totalSpend = campaign?.totalSpend || campaign?.metricsDaily.reduce((sum, m) => sum + (m.spend || 0), 0) || 0
  const cpa = totalConversions > 0 ? totalSpend / totalConversions : null
  const roas = totalSpend > 0 ? (campaign?.totalRevenue || 0) / totalSpend : null

  return (
    <Shell title="Campaign">
      <div className="p-5 space-y-4 max-w-[960px]">
        <button
          onClick={() => router.push("/dashboard/ads")}
          className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#6B7280] hover:text-[#374151] transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Ads Manager
        </button>

        {loading ? (
          <Card className="flex items-center justify-center py-16 text-[#9CA3AF]">
            <Loader2 className="animate-spin" size={20} />
          </Card>
        ) : error || !campaign ? (
          <Card className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-[13px] font-semibold text-[#374151]">{error || "Campaign not found"}</p>
          </Card>
        ) : (
          <>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-[18px] font-semibold text-[#111827]">{campaign.name}</h1>
                    <span className={cn("inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold", statusPill(campaign.status).cls)}>
                      {statusPill(campaign.status).label}
                    </span>
                  </div>
                  <p className="text-[12.5px] text-[#9CA3AF] mt-1">
                    {campaign.platform} · {campaign.objective || "—"} ·{" "}
                    {campaign.integration?.selectedAdAccountName || campaign.integration?.accountName || "No account"}
                  </p>
                </div>
                {campaign.externalId && !campaign.externalId.startsWith("local-") && campaign.platform === "GOOGLE" && (
                  <a
                    href={`https://ads.google.com/aw/campaigns?campaignId=${campaign.externalId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 h-8 px-3 text-[12.5px] font-medium text-[#374151] rounded-[8px] sku-btn"
                  >
                    View in Google Ads
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>

              <div className="grid grid-cols-5 gap-4 mt-5 pt-5 border-t border-[#F0F2F5]">
                <Kpi label="Spend" value={money(totalSpend)} />
                <Kpi label="Clicks" value={String(totalClicks)} />
                <Kpi label="Conversions" value={String(Math.round(totalConversions))} />
                <Kpi label="CPA" value={cpa ? money(cpa) : "—"} />
                <Kpi label="ROAS" value={roas ? roas.toFixed(2) + "x" : "—"} />
              </div>

              <div className="flex items-center gap-6 mt-4 pt-4 border-t border-[#F0F2F5] text-[12.5px] text-[#6B7280]">
                <span>Daily budget: <strong className="text-[#374151]">{money(campaign.dailyBudget)}</strong></span>
                {campaign.metricsDaily.length === 0 && (
                  <span className="text-[#9CA3AF]">No performance data synced yet — this appears after the next sync.</span>
                )}
              </div>
            </Card>

            <Card>
              <h2 className="text-[13.5px] font-semibold text-[#111827] mb-4">
                Ad groups ({campaign.adGroups.length})
              </h2>
              {campaign.adGroups.length === 0 ? (
                <p className="text-[12.5px] text-[#9CA3AF]">No ad groups on this campaign.</p>
              ) : (
                <div className="space-y-4">
                  {campaign.adGroups.map((g) => {
                    const positives = g.keywords.filter((k) => !k.isNegative)
                    const negatives = g.keywords.filter((k) => k.isNegative)
                    return (
                      <div key={g.id} className="rounded-[10px] border border-[#F0F2F5] p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-[13px] font-semibold text-[#111827]">{g.name}</p>
                          <span className={cn("inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold", statusPill(g.status).cls)}>
                            {statusPill(g.status).label}
                          </span>
                        </div>
                        {g.ads[0] && (
                          <div className="mt-3 p-3 rounded-[8px] bg-[#F6F7F9]">
                            <p className="text-[13px] text-[#1a0dab] font-medium">
                              {(g.ads[0].headlines || []).slice(0, 3).join(" | ")}
                            </p>
                            <p className="text-[12px] text-[#4d5156] mt-1">
                              {(g.ads[0].descriptions || []).slice(0, 2).join(" ")}
                            </p>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {positives.map((k) => (
                            <span key={k.id} className="inline-flex items-center h-6 px-2 rounded-full text-[11px] font-medium bg-[#EAF0FE] text-[#1F57F5]">
                              {k.text}
                            </span>
                          ))}
                          {negatives.map((k) => (
                            <span key={k.id} className="inline-flex items-center h-6 px-2 rounded-full text-[11px] font-medium bg-[#FBE7E5] text-[#D3564C]">
                              −{k.text}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </Shell>
  )
}
