"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useState } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { EmptyState } from "@/components/EmptyState"
import { KpiCard } from "@/components/kpi-card"
import { PlatformIcon } from "@/components/platform-icon"
import { PriorityBadge, StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useDashboardStats } from "@/hooks/useDashboardStats"
import { AlertTriangle, ArrowRight, FileBarChart2, Plug, ShieldCheck, Sparkles, TrendingUp, Zap } from "lucide-react"
import { toast } from "sonner"

const ComposedChart = dynamic(() => import("recharts").then((mod) => mod.ComposedChart), { ssr: false })
const Bar = dynamic(() => import("recharts").then((mod) => mod.Bar), { ssr: false })
const Line = dynamic(() => import("recharts").then((mod) => mod.Line), { ssr: false })
const XAxis = dynamic(() => import("recharts").then((mod) => mod.XAxis), { ssr: false })
const YAxis = dynamic(() => import("recharts").then((mod) => mod.YAxis), { ssr: false })
const Tooltip = dynamic(() => import("recharts").then((mod) => mod.Tooltip), { ssr: false })
const CartesianGrid = dynamic(() => import("recharts").then((mod) => mod.CartesianGrid), { ssr: false })
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false })

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0)
const pct = (value: number) => `${Number(value || 0).toFixed(2)}%`

type DailyBrief = {
  id: string
  summary: string
  accountHealth: any
  moneyWasted: any
  creativeFatigueAlerts: any[]
  recommendations: any[]
  createdAt: string
}

export default function DashboardPage() {
  const { data, isLoading, error, refetch } = useDashboardStats()
  const [brief, setBrief] = useState<DailyBrief | null>(null)
  const [briefLoading, setBriefLoading] = useState(true)
  const googleConnection = data?.connections?.GOOGLE
  const connectedAccountPlatforms = data?.connectedAccountPlatforms || []
  const hasGoogleIntegration = Boolean(googleConnection?.integrationId) || connectedAccountPlatforms.includes("GOOGLE")
  const hasGoogleConnection = Boolean(googleConnection) || connectedAccountPlatforms.includes("GOOGLE")
  const hasGoogleAdAccount = Boolean(googleConnection?.selectedAdAccountId || googleConnection?.hasAdsAccount) || connectedAccountPlatforms.includes("GOOGLE")
  const hasGoogleAdsAccess = Boolean(googleConnection?.hasAdsAccess && hasGoogleAdAccount)
  const hasConnectedAccount = Boolean(data?.hasAnyConnectedAccount || hasGoogleAdAccount)
  const hasConnectedPlatforms = hasConnectedAccount || hasGoogleAdsAccess || !!data?.connectedPlatforms?.length
  const hasCampaignData = !!data?.hasCampaignData
  const recommendationCount = brief?.recommendations?.length || 0

  useEffect(() => {
    if (isLoading) return
    if (!hasCampaignData) {
      setBrief(null)
      setBriefLoading(false)
      return
    }

    let active = true
    const loadBrief = () => {
      setBriefLoading(true)
      fetch("/api/ai/daily-brief")
        .then((res) => res.json())
        .then((json) => {
          if (active && json.ok) setBrief(json.brief)
        })
        .catch(() => undefined)
        .finally(() => {
          if (active) setBriefLoading(false)
        })
    }
    loadBrief()
    window.addEventListener("growzzy:workspace-changed", loadBrief)
    return () => {
      active = false
      window.removeEventListener("growzzy:workspace-changed", loadBrief)
    }
  }, [hasCampaignData, isLoading])

  const triggerSync = async () => {
    try {
      const res = await fetch("/api/integrations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "GOOGLE" }),
      })
      const json = await res.json()
      if (!res.ok || json.success === false) throw new Error(json.error || "Sync failed")
      toast.success(`Sync complete - ${json.syncedCampaigns || json.campaignCount || 0} campaigns updated`)
      window.dispatchEvent(new Event("growzzy:sync-complete"))
      await refetch()
    } catch (syncError: any) {
      toast.error(syncError.message || "Sync failed")
    }
  }

  const emptyAiState = hasGoogleAdsAccess
    ? {
        title: "Google Ads is connected - sync campaigns to begin",
        description: "Your account is linked, but there are no verified campaign metrics yet. Run Sync Now to build your daily brief.",
        label: "Sync Now",
        onClick: triggerSync,
      }
    : hasGoogleAdAccount
      ? {
          title: "Google Ads connected - no synced campaign data yet",
          description: "Your ad account is linked. Run Sync Now to import verified live campaign performance before AI analysis or reports run.",
          label: "Sync Now",
          onClick: triggerSync,
        }
      : hasGoogleConnection
      ? {
          title: "Finish Google Ads account setup",
          description: "Google authorization exists, but an ads account still needs access verification or selection before AI analysis can run.",
          label: "Finish Setup",
          href: "/dashboard/settings?tab=applications",
        }
      : hasGoogleIntegration
      ? {
          title: "Google Ads connected - finish account access setup",
          description: "Integration exists, but ads account access still needs selection or verification before AI analysis can run.",
          label: "Finish Setup",
          href: "/dashboard/settings?tab=applications",
        }
      : {
          title: "Connect Google Ads to unlock your AI media buyer",
          description: "Once campaigns sync, GROWZZY will show wasted spend, fatigue alerts, and daily action cards here.",
          label: "Connect Google Ads",
          href: "/dashboard/settings?tab=applications",
        }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">Performance overview across all connected accounts.</p>
          </div>
          <div className="hidden text-right text-xs text-muted-foreground md:block">
            Last synced <span className="font-mono">{data?.lastSyncedAt ? new Date(data.lastSyncedAt).toLocaleString() : "Never"}</span>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {data?.isStale && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            Your campaign data is older than 24 hours. Sync Google Ads before applying optimization decisions.
          </div>
        )}

        <section className="rounded-lg border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">
                  Good morning, {recommendationCount} recommendation{recommendationCount === 1 ? "" : "s"} for you.
                </h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Updated {brief?.createdAt ? new Date(brief.createdAt).toLocaleString() : "after your next sync"}.
                AI never changes campaigns without approval.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasCampaignData || briefLoading}
              onClick={async () => {
                setBriefLoading(true)
                const res = await fetch("/api/ai/daily-brief", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
                const json = await res.json().catch(() => ({}))
                setBriefLoading(false)
                if (!res.ok || !json.ok) return toast.error(json.error || "Could not refresh daily brief")
                setBrief(json.brief)
                toast.success("Daily brief refreshed")
              }}
            >
              Refresh brief
            </Button>
          </div>
          <div className="p-4">
            {briefLoading ? (
              <div className="grid gap-3 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-lg" />)}
              </div>
            ) : !brief || !hasCampaignData ? (
              <EmptyState
                icon={<ShieldCheck className="h-9 w-9" />}
                title={emptyAiState.title}
                description={emptyAiState.description}
                action={{ label: emptyAiState.label, ...("onClick" in emptyAiState ? { onClick: emptyAiState.onClick } : { href: emptyAiState.href }) }}
              />
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border bg-slate-950 p-5 text-white shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-white/50">AI workload</p>
                        <h3 className="mt-2 text-2xl font-semibold">Save work for your team</h3>
                        <p className="mt-2 text-sm text-white/65">
                          {recommendationCount
                            ? `${recommendationCount} account actions are ready for review.`
                            : "No urgent actions found from verified synced data."}
                        </p>
                      </div>
                      <div className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">{brief.accountHealth?.overallScore || 0}/100</div>
                    </div>
                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between text-xs text-white/60">
                        <span>Account automation coverage</span>
                        <span>{recommendationCount ? Math.min(85, 35 + recommendationCount * 8) : 0}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${recommendationCount ? Math.min(85, 35 + recommendationCount * 8) : 0}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Monthly goals</p>
                    <div className="mt-4 space-y-4">
                      <GoalRow label="Conversions" value={String(data?.totals.conversions || 0)} target={String(Math.max(1, Math.ceil((data?.totals.conversions || 0) * 1.25)))} progress={Math.min(100, ((data?.totals.conversions || 0) / Math.max(1, (data?.totals.conversions || 0) * 1.25)) * 100)} />
                      <GoalRow label="Amount spent" value={money(data?.totals.spend || 0)} target={money(Math.max(1, (data?.totals.spend || 0) * 1.2))} progress={Math.min(100, ((data?.totals.spend || 0) / Math.max(1, (data?.totals.spend || 0) * 1.2)) * 100)} />
                      <GoalRow label="Blended ROAS" value={`${Number(data?.totals.avgRoas || 0).toFixed(2)}x`} target="4.00x" progress={Math.min(100, (Number(data?.totals.avgRoas || 0) / 4) * 100)} />
                    </div>
                  </div>
                </div>
                <p className="text-sm leading-6 text-slate-700">{brief.summary}</p>
                <div className="grid gap-3 md:grid-cols-4">
                  <BriefCard label="Account Health" value={`${brief.accountHealth?.overallScore || 0}/100`} helper={brief.accountHealth?.topIssue || "No critical issue found"} />
                  <BriefCard label="Money Wasted" value={brief.moneyWasted?.label || "$0"} helper={`${brief.moneyWasted?.campaigns?.length || 0} zero-conversion campaigns`} tone={Number(brief.moneyWasted?.amount || 0) > 0 ? "danger" : "good"} />
                  <BriefCard label="Creative Fatigue" value={String(brief.creativeFatigueAlerts?.length || 0)} helper="CTR decline alerts" />
                  <BriefCard label="Actions Today" value={String(brief.recommendations?.length || 0)} helper="Preview before apply" />
                </div>
                <div className="space-y-2">
                  {(brief.recommendations || []).slice(0, 3).map((rec) => (
                    <div key={rec.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <PriorityBadge priority={rec.priority || "MEDIUM"} />
                          <span className="truncate text-sm font-semibold">{rec.title}</span>
                          <span className="text-xs text-muted-foreground">{rec.campaignName}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{rec.reasoning}</p>
                      </div>
                      <Link href="/dashboard/ai-advisor">
                        <Button size="sm" variant="outline" className="gap-1">
                          Preview <Zap className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-lg" />)}
          </div>
        ) : !hasCampaignData ? (
          <EmptyState
            icon={hasConnectedPlatforms ? <TrendingUp className="h-10 w-10" /> : <Plug className="h-10 w-10" />}
            title={hasConnectedPlatforms || hasGoogleIntegration ? "You're connected - create your first campaign" : "Connect your Google Ads account"}
            description={hasConnectedPlatforms || hasGoogleIntegration ? "Create your first campaign to start seeing verified performance data here." : "Connect Google Ads from settings to start syncing real campaign performance."}
            action={{ label: hasConnectedPlatforms || hasGoogleIntegration ? "Create Campaign" : "Connect Google Ads", href: hasConnectedPlatforms || hasGoogleIntegration ? "/dashboard/campaigns/new" : "/dashboard/settings?tab=applications" }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Total Spend" value={money(data?.totals.spend || 0)} delta={data?.kpis?.spend.changePercent || 0} />
            <KpiCard label="ROAS" value={`${Number(data?.totals.avgRoas || 0).toFixed(2)}x`} delta={data?.kpis?.roas.changePercent || 0} />
            <KpiCard label="CPA" value={money(data?.totals.avgCpc || 0)} delta={data?.kpis?.spend.changePercent || 0} inverse />
            <KpiCard label="Conversions" value={String(data?.totals.conversions || 0)} delta={data?.kpis?.conversions.changePercent || 0} />
          </div>
        )}

        <section className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b p-4">
            <div>
              <h2 className="text-sm font-semibold">Performance</h2>
              <p className="text-xs text-muted-foreground">Spend bars and ROAS line over time.</p>
            </div>
            <Button variant="outline" size="sm" onClick={triggerSync}>Sync Now</Button>
          </div>
          <div className="h-72 p-4">
            {isLoading ? (
              <Skeleton className="h-full rounded-lg" />
            ) : data?.spendByDay?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.spendByDay.map((item) => ({ ...item, roas: data.totals.avgRoas }))} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: unknown, name: unknown) => (String(name).toLowerCase().includes("roas") ? [`${Number(value || 0).toFixed(2)}x`, "ROAS"] : [money(Number(value || 0)), "Spend"])}
                  />
                  <Bar yAxisId="left" dataKey="spend" name="Spend" fill="var(--primary)" opacity={0.85} radius={[3, 3, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="roas" name="ROAS" stroke="#10B981" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={<FileBarChart2 className="h-8 w-8" />} title="No spend data yet" description="Spend history appears after the first successful sync." />
            )}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-lg border bg-card lg:col-span-2">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <h2 className="text-sm font-semibold">Campaign Performance</h2>
                <p className="text-xs text-muted-foreground">Top 5 campaigns ranked by spend.</p>
              </div>
              <Link href="/dashboard/campaigns" className="text-xs text-primary hover:underline">View all →</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Name</th>
                    <th className="px-2 py-2 text-left font-medium">Platform</th>
                    <th className="px-2 py-2 text-left font-medium">Status</th>
                    <th className="px-2 py-2 text-right font-medium">Spend</th>
                    <th className="px-2 py-2 text-right font-medium">ROAS</th>
                    <th className="px-4 py-2 text-right font-medium">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.topCampaigns || []).slice(0, 5).map((campaign) => (
                    <tr key={campaign.id} className="border-b last:border-b-0 hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium">{campaign.name}</td>
                      <td className="px-2 py-3"><PlatformIcon platform="GOOGLE" /></td>
                      <td className="px-2 py-3"><StatusBadge status={campaign.status} /></td>
                      <td className="px-2 py-3 text-right font-mono">{money(campaign.spend)}</td>
                      <td className="px-2 py-3 text-right font-mono">{Number(campaign.roas || 0).toFixed(2)}x</td>
                      <td className="px-4 py-3 text-right font-mono">{pct(data?.totals.avgCtr || 0)}</td>
                    </tr>
                  ))}
                  {!data?.topCampaigns?.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No synced campaigns yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border bg-card">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <h2 className="text-sm font-semibold">Today's Recommendations</h2>
                <p className="text-xs text-muted-foreground">From AI Advisor</p>
              </div>
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="space-y-3 p-4">
              <div className="rounded-lg border p-3">
                <PriorityBadge priority="MEDIUM" />
                <div className="mt-2 text-sm font-medium">{data?.topCampaigns?.[0]?.name ? `Audit ${data.topCampaigns[0].name}` : "Run your first AI audit"}</div>
                <p className="mt-1 text-xs text-muted-foreground">Recommendations only use synced campaign data. Disconnected platforms stay locked.</p>
              </div>
              <Link href="/dashboard/ai-advisor">
                <Button variant="ghost" size="sm" className="w-full justify-between text-primary hover:text-primary">
                  View AI Advisor <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </section>
        </div>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Platform Breakdown</h2>
            <Link href="/dashboard/accounts" className="text-xs text-primary hover:underline">Manage accounts →</Link>
          </div>
          <div className="grid gap-4">
            {(["GOOGLE"] as const).map((platform) => {
              const platformData = data?.byPlatform?.[platform] || null
              const connection = data?.connections?.[platform]
              const platformConnected = Boolean(connection?.selectedAdAccountId && connection?.hasAdsAccess)
              return (
                <div key={platform} className="rounded-lg border bg-card p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <PlatformIcon platform={platform} className="h-6 w-6" />
                      <div>
                        <div className="text-sm font-semibold">Google Ads</div>
                        <div className="text-[11px] text-muted-foreground">{platformConnected ? (platformData ? "Connected - live data" : "Connected - no metrics yet") : "Connect to unlock"}</div>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${platformConnected ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                      <span className={`h-1 w-1 rounded-full ${platformConnected ? "bg-emerald-500" : "bg-slate-300"}`} /> {platformConnected ? "Connected" : "Locked"}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Spend MTD</div>
                      <div className="font-mono text-lg font-semibold">{platformData ? money(platformData.spend) : "—"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">ROAS</div>
                      <div className="font-mono text-lg font-semibold">{platformData ? `${platformData.avgRoas.toFixed(2)}x` : "—"}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </DashboardLayout>
  )
}

function GoalRow({ label, value, target, progress }: { label: string; value: string; target: string; progress: number }) {
  const safeProgress = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0))
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="font-mono text-slate-950">
          {value} <span className="text-muted-foreground">/ {target}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${safeProgress}%` }} />
      </div>
    </div>
  )
}

function BriefCard({ label, value, helper, tone = "neutral" }: { label: string; value: string; helper: string; tone?: "neutral" | "danger" | "good" }) {
  return (
    <div className={`rounded-lg border p-3 ${tone === "danger" ? "border-red-200 bg-red-50" : tone === "good" ? "border-emerald-200 bg-emerald-50" : "bg-white"}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 font-mono text-2xl font-semibold text-slate-950">{value}</div>
      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{helper}</div>
    </div>
  )
}
