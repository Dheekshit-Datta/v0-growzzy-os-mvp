"use client"

import { useEffect, useState } from "react"
import { Shell } from "@/components/dashboard-v2/shell"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { ChevronDown, BarChart2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Overview = {
  kpis: {
    totalSpend: number
    totalClicks: number
    ctr: number
    roas: number
    connectedPlatforms: number
  }
  chartData: { date: string; spend: number; revenue: number }[]
  topCampaigns: { id: string; name: string; platform: string; status: string; spend: number; revenue: number; roas: number }[]
  platformBreakdown: { name: string; spend: number; revenue: number; roas: number; campaigns: number; percentOfSpend: number }[]
}

const DAY_OPTIONS = [
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 },
]

function money(n: number) {
  return "$" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function Dropdown({
  label, options, value, onChange,
}: { label: string; options: { label: string; value: string }[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 h-8 px-3 bg-white border border-[#E9EBEF] rounded-[8px] text-[12.5px] font-medium text-[#374151] hover:border-[#D1D5DB] transition-colors"
      >
        {label} <ChevronDown size={13} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-[180px] bg-white border border-[#E9EBEF] rounded-[8px] shadow-lg z-20 overflow-hidden">
            {options.map((o) => (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={cn(
                  "w-full text-left px-3 py-2 text-[12.5px] hover:bg-[#F6F7F9] transition-colors",
                  o.value === value ? "text-[#1F57F5] font-semibold" : "text-[#374151]"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Overview | null>(null)
  const [tab, setTab] = useState<"campaign" | "keyword" | "device">("campaign")
  const [days, setDays] = useState(30)
  const [platform, setPlatform] = useState("all")
  const [metric, setMetric] = useState<"spend" | "revenue">("spend")

  useEffect(() => {
    setLoading(true)
    fetch(`/api/analytics/overview?days=${days}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setData(json?.data ?? null))
      .finally(() => setLoading(false))
  }, [days])

  const kpis = data?.kpis
  const hasData = !!data && data.kpis.connectedPlatforms > 0

  const platformOptions = [
    { label: "All platforms", value: "all" },
    ...(data?.platformBreakdown ?? []).map((p) => ({ label: p.name, value: p.name })),
  ]
  const filteredCampaigns = (data?.topCampaigns ?? []).filter((c) => platform === "all" || c.platform === platform)

  const kpiCards = [
    { label: "Total Spend", value: kpis ? money(kpis.totalSpend) : "$0" },
    { label: "Clicks", value: kpis ? String(kpis.totalClicks) : "0" },
    { label: "CTR", value: kpis && kpis.totalClicks > 0 ? kpis.ctr.toFixed(2) + "%" : "—" },
    { label: "ROAS", value: kpis && kpis.totalSpend > 0 ? kpis.roas.toFixed(2) + "x" : "—" },
  ]

  return (
    <Shell title="Analytics">
      <div className="p-6 space-y-5">
        {/* Filters */}
        <div className="flex items-center gap-2">
          <Dropdown
            label={DAY_OPTIONS.find((d) => d.value === days)?.label || "Last 30 days"}
            options={DAY_OPTIONS.map((d) => ({ label: d.label, value: String(d.value) }))}
            value={String(days)}
            onChange={(v) => setDays(Number(v))}
          />
          <Dropdown
            label={platform === "all" ? "All platforms" : platform}
            options={platformOptions}
            value={platform}
            onChange={setPlatform}
          />
        </div>

        {loading ? (
          <div className="bg-white rounded-[14px] border border-[#E9EBEF] p-16 flex items-center justify-center text-[#9CA3AF]">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-4 gap-4">
              {kpiCards.map((kpi) => (
                <div key={kpi.label} className="bg-white rounded-[14px] border border-[#E9EBEF] p-4">
                  <p className="text-[12px] font-medium text-[#6B7280] mb-2">{kpi.label}</p>
                  <p className="text-[26px] font-bold text-[#111827] tabular leading-none">{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="bg-white rounded-[14px] border border-[#E9EBEF] p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[14px] font-semibold text-[#111827]">Performance over time</p>
                <div className="flex items-center gap-2">
                  <Dropdown
                    label={metric === "spend" ? "Spend" : "Revenue"}
                    options={[{ label: "Spend", value: "spend" }, { label: "Revenue", value: "revenue" }]}
                    value={metric}
                    onChange={(v) => setMetric(v as "spend" | "revenue")}
                  />
                </div>
              </div>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.chartData ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "white", border: "1px solid #E9EBEF", borderRadius: 10, fontSize: 12 }} />
                    <Line type="monotone" dataKey={metric} stroke="#1F57F5" strokeWidth={2} dot={false} name={metric === "spend" ? "Spend ($)" : "Revenue ($)"} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Breakdown tabs */}
            <div className="bg-white rounded-[14px] border border-[#E9EBEF] overflow-hidden">
              <div className="border-b border-[#E9EBEF] px-5">
                <div className="flex gap-1">
                  {([
                    { id: "campaign", label: "By campaign" },
                    { id: "keyword", label: "By keyword" },
                    { id: "device", label: "By device" },
                  ] as const).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={cn(
                        "h-10 px-4 text-[13px] font-medium border-b-2 transition-colors",
                        tab === t.id ? "border-[#1F57F5] text-[#1F57F5]" : "border-transparent text-[#6B7280] hover:text-[#374151]"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {tab === "campaign" && hasData && filteredCampaigns.length > 0 ? (
                <div className="divide-y divide-[#F0F2F5]">
                  {filteredCampaigns.map((c) => (
                    <div key={c.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-[13px] font-medium text-[#111827]">{c.name}</p>
                        <p className="text-[11.5px] text-[#9CA3AF]">{c.platform}</p>
                      </div>
                      <div className="flex items-center gap-6 text-[12.5px] text-[#374151] tabular">
                        <span>{money(c.spend)}</span>
                        <span>{c.roas ? c.roas.toFixed(2) + "x" : "—"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-10 h-10 bg-[#F6F7F9] rounded-full flex items-center justify-center mb-3">
                    <BarChart2 size={18} className="text-[#D1D5DB]" />
                  </div>
                  <p className="text-[13px] font-medium text-[#374151]">No data yet</p>
                  <p className="text-[12px] text-[#9CA3AF] mt-1">
                    {tab === "campaign"
                      ? "Connect your Google Ads account to see campaign breakdowns."
                      : `${tab === "keyword" ? "Keyword" : "Device"} breakdowns aren't available yet.`}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Shell>
  )
}
