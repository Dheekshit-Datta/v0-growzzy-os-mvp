"use client"

import { Shell } from "@/components/shell"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { ChevronDown, BarChart2 } from "lucide-react"

const CHART_DATA = Array.from({ length: 12 }, (_, i) => ({
  month: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i],
  spend: 0,
  conversions: 0,
}))

const KPI_CARDS = [
  { label: "Total Spend", value: "$0" },
  { label: "Clicks", value: "0" },
  { label: "CTR", value: "—" },
  { label: "ROAS", value: "—" },
]

export default function AnalyticsPage() {
  return (
    <Shell title="Analytics">
      <div className="p-6 space-y-5">
        {/* Filters */}
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 h-8 px-3 bg-white border border-[#E9EBEF] rounded-[8px] text-[12.5px] font-medium text-[#374151] hover:border-[#D1D5DB] transition-colors">
            Last 30 days <ChevronDown size={13} />
          </button>
          <button className="flex items-center gap-1.5 h-8 px-3 bg-white border border-[#E9EBEF] rounded-[8px] text-[12.5px] font-medium text-[#374151] hover:border-[#D1D5DB] transition-colors">
            All campaigns <ChevronDown size={13} />
          </button>
          <button className="flex items-center gap-1.5 h-8 px-3 bg-white border border-[#E9EBEF] rounded-[8px] text-[12.5px] font-medium text-[#374151] hover:border-[#D1D5DB] transition-colors">
            All platforms <ChevronDown size={13} />
          </button>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-4 gap-4">
          {KPI_CARDS.map((kpi) => (
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
              <button className="flex items-center gap-1 h-8 px-3 bg-white border border-[#E9EBEF] rounded-[8px] text-[12px] text-[#374151] hover:border-[#D1D5DB] transition-colors">
                Spend <ChevronDown size={12} />
              </button>
            </div>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={CHART_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "white", border: "1px solid #E9EBEF", borderRadius: 10, fontSize: 12 }} />
                <Line type="monotone" dataKey="spend" stroke="#1F57F5" strokeWidth={2} dot={false} name="Spend ($)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Breakdown tabs */}
        <div className="bg-white rounded-[14px] border border-[#E9EBEF] overflow-hidden">
          <div className="border-b border-[#E9EBEF] px-5">
            <div className="flex gap-1">
              {["By campaign", "By keyword", "By device"].map((tab, i) => (
                <button
                  key={tab}
                  className={`h-10 px-4 text-[13px] font-medium border-b-2 transition-colors ${
                    i === 0
                      ? "border-[#1F57F5] text-[#1F57F5]"
                      : "border-transparent text-[#6B7280] hover:text-[#374151]"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-10 h-10 bg-[#F6F7F9] rounded-full flex items-center justify-center mb-3">
              <BarChart2 size={18} className="text-[#D1D5DB]" />
            </div>
            <p className="text-[13px] font-medium text-[#374151]">No data yet</p>
            <p className="text-[12px] text-[#9CA3AF] mt-1">Connect your Google Ads account to see campaign breakdowns.</p>
          </div>
        </div>
      </div>
    </Shell>
  )
}
