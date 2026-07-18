"use client"

import { useEffect, useState } from "react"
import { Shell } from "@/components/dashboard-v2/shell"
import { PenSquare, Plus, Loader2, ArrowRight } from "lucide-react"
import Link from "next/link"

type Brief = {
  id: string
  status: string
  campaignName: string
  brief: { offer?: string; targetCustomer?: string; budget?: number; location?: string; goal?: string } | null
  createdAt: string
  launched: boolean
}

export default function PromptsPage() {
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<Brief[]>([])

  useEffect(() => {
    fetch("/api/ai/campaign-plans", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setPlans(json?.plans ?? []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Shell title="Recent Prompts">
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-[13px] text-[#6B7280]">Your saved campaign briefs. Re-run any to instantly start a new campaign.</p>
          <Link href="/dashboard/campaigns/new" className="flex items-center gap-1.5 h-8 px-4 text-white text-[12.5px] font-semibold rounded-[8px] sku-btn-primary">
            <Plus size={13} />
            New campaign
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-[#9CA3AF]">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
              style={{ background: "linear-gradient(145deg, #e8eaed 0%, #f4f5f7 100%)", boxShadow: "0 1px 3px rgba(0,0,0,0.08) inset" }}
            >
              <PenSquare size={20} className="text-[#D1D5DB]" />
            </div>
            <p className="text-[14px] font-semibold text-[#374151]">No saved prompts yet</p>
            <p className="text-[12.5px] text-[#9CA3AF] mt-1 max-w-[280px]">
              Create a campaign and your brief will be saved here for quick re-use.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {plans.map((p) => (
              <div key={p.id} className="bg-white rounded-[12px] border border-[#E9EBEF] p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#111827] truncate">{p.campaignName}</p>
                  <p className="text-[11.5px] text-[#9CA3AF] mt-0.5 truncate">{p.brief?.offer || "No brief text"}</p>
                  <p className="text-[11px] text-[#9CA3AF] mt-1">
                    {p.brief?.location || "—"} · ${p.brief?.budget ?? "?"}/day · {new Date(p.createdAt).toLocaleDateString()}
                    {p.launched && <span className="ml-2 text-[#2E9E5B] font-semibold">Launched</span>}
                  </p>
                </div>
                <Link
                  href={{ pathname: "/dashboard/campaigns/new", query: { reuse: p.id } }}
                  className="flex items-center gap-1 h-8 px-3 text-[12.5px] font-semibold text-[#1F57F5] hover:text-[#1849d6] transition-colors shrink-0"
                >
                  Use again <ArrowRight size={12} />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  )
}
