"use client"

import { useState } from "react"
import { Search, Bell, HelpCircle, Plus, X } from "lucide-react"
import Link from "next/link"

interface TopBarProps {
  title?: string
}

export function TopBar({ title }: TopBarProps) {
  const [showSearch, setShowSearch] = useState(false)
  const [query, setQuery] = useState("")
  const [hasNotif] = useState(false)

  return (
    <header
      className="h-[52px] flex items-center justify-between px-4 shrink-0 border-b border-[#DDE1E7]"
      style={{
        background: 'linear-gradient(180deg, #ffffff 0%, #f8f9fb 100%)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 1px 4px rgba(0,0,0,0.05)',
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-3">
        {title && (
          <h1 className="text-[15px] font-semibold text-[#111827] tracking-tight">{title}</h1>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5">
        {/* Search */}
        {showSearch ? (
          <div className="flex items-center gap-2 h-8 px-3 rounded-[8px] w-[220px] sku-input">
            <Search size={13} className="text-[#9CA3AF] shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              onKeyDown={(e) => {
                if (e.key === "Escape") { setShowSearch(false); setQuery("") }
                if (e.nativeEvent.isComposing) return
              }}
              className="flex-1 bg-transparent text-[12.5px] text-[#111827] placeholder-[#9CA3AF] outline-none"
            />
            <button
              onClick={() => { setShowSearch(false); setQuery("") }}
              className="text-[#9CA3AF] hover:text-[#374151] transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-2 h-8 px-3 rounded-[8px] text-[12.5px] text-[#9CA3AF] hover:text-[#374151] transition-colors sku-btn min-w-[160px]"
          >
            <Search size={13} />
            <span>Quick find</span>
            <span className="ml-auto text-[10px] font-medium text-[#9CA3AF] bg-[#EAECF0] px-1.5 py-0.5 rounded-[4px]">⌘K</span>
          </button>
        )}

        {/* Help */}
        <button
          className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[#9CA3AF] hover:text-[#374151] transition-colors sku-btn"
          aria-label="Help"
        >
          <HelpCircle size={15} />
        </button>

        {/* Notifications */}
        <button
          className="relative w-8 h-8 flex items-center justify-center rounded-[8px] text-[#9CA3AF] hover:text-[#374151] transition-colors sku-btn"
          aria-label="Notifications"
        >
          <Bell size={15} />
          {hasNotif && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#1F57F5] rounded-full" />
          )}
        </button>

        {/* New campaign CTA */}
        <Link
          href="/campaigns/new"
          className="flex items-center gap-1.5 h-8 px-3.5 text-white text-[12.5px] font-semibold rounded-[8px] transition-colors sku-btn-primary"
        >
          <Plus size={13} />
          New Campaign
        </Link>
      </div>
    </header>
  )
}
