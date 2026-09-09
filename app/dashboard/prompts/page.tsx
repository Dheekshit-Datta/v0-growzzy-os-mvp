"use client"

import { useEffect, useState } from "react"
import { Shell } from "@/components/dashboard-v2/shell"
import { PenSquare, Plus, Loader2, ArrowRight } from "lucide-react"
import Link from "next/link"

type Chat = { id: string; title: string; updatedAt: string }

export default function PromptsPage() {
  const [loading, setLoading] = useState(true)
  const [chats, setChats] = useState<Chat[]>([])

  useEffect(() => {
    fetch("/api/ai/conversations", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setChats(json?.conversations ?? []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Shell title="Recent Chats">
      <div className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <p className="text-[13px] text-[#6B7280]">Your saved conversations. Pick one up exactly where you left off.</p>
          <Link href="/dashboard/campaigns/new" className="sku-btn-primary flex h-8 items-center gap-1.5 rounded-[8px] px-4 text-[12.5px] font-semibold text-white">
            <Plus size={13} /> New campaign
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-24 text-[#9CA3AF]"><Loader2 className="animate-spin" size={20} /></div>
        ) : chats.length === 0 ? (
          <div className="flex flex-col items-center py-24 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#F4F5F7]"><PenSquare size={20} className="text-[#D1D5DB]" /></div>
            <p className="text-[14px] font-semibold text-[#374151]">No saved chats yet</p>
            <p className="mt-1 max-w-[280px] text-[12.5px] text-[#9CA3AF]">Start a campaign chat and it will appear here automatically.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {chats.map((chat) => (
              <div key={chat.id} className="flex items-center justify-between gap-4 rounded-[12px] border border-[#E9EBEF] bg-white p-4">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-[#111827]">{chat.title || "Untitled chat"}</p>
                  <p className="mt-1 text-[11px] text-[#9CA3AF]">Last updated {new Date(chat.updatedAt).toLocaleDateString()}</p>
                </div>
                <Link href={{ pathname: "/dashboard/campaigns/new", query: { threadId: chat.id } }} className="flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-[#1F57F5] hover:text-[#1849d6]">
                  Open chat <ArrowRight size={12} />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  )
}
