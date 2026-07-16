"use client"

import { useState } from "react"
import { Shell } from "@/components/dashboard-v2/shell"
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { TrendingUp, Download, ChevronDown, AlertCircle, Plus, X } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

const PERIOD_OPTIONS = ["Last 7 days", "Last 30 days", "Last 90 days", "All time"]

const CHART_DATA = [
  { month: "Jan", spend: 0, conversions: 0 },
  { month: "Feb", spend: 0, conversions: 0 },
  { month: "Mar", spend: 0, conversions: 0 },
  { month: "Apr", spend: 0, conversions: 0 },
  { month: "May", spend: 0, conversions: 0 },
  { month: "Jun", spend: 0, conversions: 0 },
]

const CHART_TABS = ["Daily", "Weekly", "Monthly"]

function KpiCard({ label, value, caption, trend }: { label: string; value: string; caption: string; trend?: { direction: "up" | "down"; percent: number } }) {
  return (
    <div
      className="rounded-[14px] p-4"
      style={{
        background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fb 100%)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 -1px 0 rgba(0,0,0,0.04) inset, 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.06)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[12px] font-semibold text-[#6B7280]">{label}</p>
        {trend && (
          <div
            className={cn(
              "inline-flex items-center gap-1 h-5 px-2 rounded-[5px] text-[10px] font-semibold",
              trend.direction === "up"
                ? "bg-[#E6F4EC] text-[#2E9E5B]"
                : "bg-[#FBE7E5] text-[#D3564C]"
            )}
          >
            {trend.direction === "up" ? "↑" : "↓"} {trend.percent}%
          </div>
        )}
      </div>
      <p className="text-[26px] font-bold text-[#111827] tabular leading-none mb-1">{value}</p>
      <p className="text-[11px] text-[#9CA3AF]">{caption}</p>
    </div>
  )
}

export default function DashboardPage() {
  const [period, setPeriod] = useState("Last 30 days")
  const [periodOpen, setPeriodOpen] = useState(false)
  const [chartTab, setChartTab] = useState("Monthly")
  const [bannerDismissed, setBannerDismissed] = useState(false)

  return (
    <Shell title="Dashboard">
      <div className="p-5 space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="relative">
            <button
              onClick={() => setPeriodOpen(!periodOpen)}
              className="flex items-center gap-1.5 h-8 px-3 text-[12.5px] font-semibold text-[#374151] rounded-[8px] sku-btn"
            >
              {period}
              <ChevronDown size={13} />
            </button>
            {periodOpen && (
              <div
                className="absolute top-full left-0 mt-1 w-[160px] rounded-[10px] border border-[#DDE1E7] z-10 overflow-hidden"
                style={{
                  background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fb 100%)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
                }}
              >
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => { setPeriod(opt); setPeriodOpen(false) }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-[12.5px] transition-colors",
                      opt === period ? "text-[#1F57F5] font-semibold bg-[#EAF0FE]" : "text-[#374151] font-medium hover:bg-[#F0F2F5]"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="flex items-center gap-1.5 h-8 px-3 text-[12.5px] font-semibold text-[#374151] rounded-[8px] sku-btn">
            <Download size={13} />
            Export
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-3">
          <KpiCard label="Total Spend" value="$0" caption="No campaigns live yet" />
          <KpiCard label="Conversions" value="0" caption="No data yet" />
          <KpiCard label="Cost / Result" value="—" caption="No data yet" trend={{ direction: "down", percent: 12 }} />
          <KpiCard label="ROAS" value="—" caption="No data yet" trend={{ direction: "up", percent: 8 }} />
        </div>

        {/* Connect banner */}
        {!bannerDismissed && (
          <div
            className="rounded-[14px] p-4 flex items-start justify-between"
            style={{
              background: 'linear-gradient(135deg, #EAF0FE 0%, #dce8fd 100%)',
              boxShadow: '0 1px 0 rgba(255,255,255,0.7) inset, 0 2px 8px rgba(31,87,245,0.1), 0 0 0 1px rgba(31,87,245,0.15)',
            }}
          >
            <div className="flex items-start gap-3">
              <AlertCircle size={16} className="text-[#1F57F5] mt-0.5 shrink-0" />
              <div>
                <p className="text-[13px] font-semibold text-[#111827] mb-0.5">Connect Google Ads to see your data</p>
                <p className="text-[12px] text-[#6B7280]">
                  Link your account to pull in live spend, conversions and ROAS.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4 shrink-0">
              <Link
                href="/dashboard/settings?tab=integrations"
                className="flex items-center gap-1.5 h-8 px-4 text-white text-[12.5px] font-semibold rounded-[8px] sku-btn-primary"
              >
                Connect Google Ads
              </Link>
              <button
                onClick={() => setBannerDismissed(true)}
                className="w-7 h-7 flex items-center justify-center rounded-[7px] text-[#6B7280] hover:bg-[#D0DEF9] transition-colors"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Charts row */}
        <div className="grid grid-cols-3 gap-4">
          {/* Spend + Conversions chart */}
          <div
            className="col-span-2 rounded-[14px] p-5"
            style={{
              background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fb 100%)',
              boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.06)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[14px] font-semibold text-[#111827]">Spend & conversions</p>
                <p className="text-[11.5px] text-[#9CA3AF]">Connect an account to see real data</p>
              </div>
              <div
                className="flex items-center rounded-[8px] p-0.5"
                style={{
                  background: 'linear-gradient(145deg, #e8eaed 0%, #f0f2f5 100%)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1) inset',
                }}
              >
                {CHART_TABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setChartTab(t)}
                    className={cn(
                      "h-6 px-2.5 rounded-[6px] text-[11.5px] font-semibold transition-colors",
                      chartTab === t ? "bg-white text-[#111827] shadow-sm" : "text-[#9CA3AF] hover:text-[#374151]"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={CHART_DATA} barSize={18} barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF", fontFamily: "Inter" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#9CA3AF", fontFamily: "Inter" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "white", border: "1px solid #DDE1E7", borderRadius: 10, fontSize: 12, fontFamily: "Inter", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                    cursor={{ fill: "rgba(31,87,245,0.04)" }}
                  />
                  <Bar dataKey="spend" fill="#1F57F5" radius={[4, 4, 0, 0]} name="Spend ($)" />
                  <Bar dataKey="conversions" fill="#93B4FB" radius={[4, 4, 0, 0]} name="Conversions" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Needs attention */}
          <div
            className="rounded-[14px] p-5"
            style={{
              background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fb 100%)',
              boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.06)',
            }}
          >
            <p className="text-[14px] font-semibold text-[#111827] mb-0.5">Needs attention</p>
            <p className="text-[11.5px] text-[#9CA3AF] mb-4">AI recommendations appear here</p>
            <div className="flex flex-col items-center justify-center h-[148px] text-center">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                style={{
                  background: 'linear-gradient(145deg, #e8eaed 0%, #f4f5f7 100%)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08) inset',
                }}
              >
                <AlertCircle size={18} className="text-[#D1D5DB]" />
              </div>
              <p className="text-[12.5px] font-semibold text-[#374151]">No recommendations yet</p>
              <p className="text-[11px] text-[#9CA3AF] mt-1">
                Connect your ad account to get AI-powered suggestions.
              </p>
            </div>
          </div>
        </div>

        {/* Top campaigns table */}
        <div
          className="rounded-[14px] overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fb 100%)',
            boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.06)',
          }}
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#DDE1E7]">
            <p className="text-[14px] font-semibold text-[#111827]">Top campaigns</p>
            <span className="text-[11.5px] text-[#9CA3AF]">{period}</span>
          </div>
          <div className="flex flex-col items-center justify-center py-12 text-center px-6">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
              style={{
                background: 'linear-gradient(145deg, #e8eaed 0%, #f4f5f7 100%)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08) inset',
              }}
            >
              <TrendingUp size={18} className="text-[#D1D5DB]" />
            </div>
            <p className="text-[13px] font-semibold text-[#374151]">No campaigns yet</p>
            <p className="text-[11.5px] text-[#9CA3AF] mt-1 max-w-[260px]">
              Create your first campaign and connect Google Ads to see performance data here.
            </p>
            <Link
              href="/dashboard/campaigns/new"
              className="mt-4 flex items-center gap-1.5 h-8 px-4 text-white text-[12.5px] font-semibold rounded-[8px] sku-btn-primary"
            >
              <Plus size={13} />
              Create first campaign
            </Link>
          </div>
        </div>
      </div>
    </Shell>
  )
}
