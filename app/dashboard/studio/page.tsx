"use client"

import { Shell } from "@/components/dashboard-v2/shell"
import { Sparkles } from "lucide-react"

export default function AdStudioPage() {
  return (
    <Shell title="Ad Studio">
      <div className="p-5">
        <div
          className="rounded-[14px] p-10 flex flex-col items-center justify-center text-center"
          style={{ background: "linear-gradient(145deg, #ffffff 0%, #f8f9fb 100%)", boxShadow: "0 1px 0 rgba(255,255,255,0.9) inset, 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.06)" }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(145deg, #e8eaed 0%, #f4f5f7 100%)", boxShadow: "0 1px 3px rgba(0,0,0,0.08) inset" }}
          >
            <Sparkles size={22} className="text-[#D1D5DB]" />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[15px] font-semibold text-[#111827]">AI Ad Creative Generation</p>
            <span className="text-[9.5px] font-bold text-[#6B7280] bg-[#E0E2E6] px-1.5 py-0.5 rounded-full uppercase tracking-wide">Coming soon</span>
          </div>
          <p className="text-[12.5px] text-[#9CA3AF] max-w-[360px]">
            Real AI-generated ad creatives, built from your brand kit, are in development. For now, your campaign builder generates real headline and description copy for Google Search ads.
          </p>
        </div>
      </div>
    </Shell>
  )
}
