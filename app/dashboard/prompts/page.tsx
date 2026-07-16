"use client"

import { Shell } from "@/components/dashboard-v2/shell"
import { PenSquare, Plus } from "lucide-react"
import Link from "next/link"

export default function PromptsPage() {
  return (
    <Shell title="Recent Prompts">
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-[13px] text-[#6B7280]">
            Your saved campaign briefs. Re-run any to instantly start a new campaign.
          </p>
          <Link
            href="/dashboard/campaigns/new"
            className="flex items-center gap-1.5 h-8 px-4 text-white text-[12.5px] font-semibold rounded-[8px] sku-btn-primary"
          >
            <Plus size={13} />
            New campaign
          </Link>
        </div>

        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
            style={{
              background: "linear-gradient(145deg, #e8eaed 0%, #f4f5f7 100%)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08) inset",
            }}
          >
            <PenSquare size={20} className="text-[#D1D5DB]" />
          </div>
          <p className="text-[14px] font-semibold text-[#374151]">No saved prompts yet</p>
          <p className="text-[12.5px] text-[#9CA3AF] mt-1 max-w-[280px]">
            Create a campaign and your brief will be saved here for quick re-use.
          </p>
        </div>
      </div>
    </Shell>
  )
}
