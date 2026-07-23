"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Search, Bell, MessageSquare, Plus, X, Loader2 } from "lucide-react"
import Link from "next/link"

interface TopBarProps {
  title?: string
}

type Notification = { id: string; title: string; body: string; type: string; isRead: boolean; createdAt: string }
type CampaignResult = { id: string; name: string; platform: string }

export function TopBar({ title }: TopBarProps) {
  const router = useRouter()
  const [showSearch, setShowSearch] = useState(false)
  const [query, setQuery] = useState("")
  const [searchResults, setSearchResults] = useState<CampaignResult[]>([])
  const [searching, setSearching] = useState(false)

  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/api/notifications", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        setNotifications(json?.notifications ?? [])
        setUnreadCount(json?.unreadCount ?? 0)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setSearching(true)
    const t = setTimeout(() => {
      fetch("/api/campaigns", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          const all: CampaignResult[] = json?.data?.campaigns ?? []
          const q = query.trim().toLowerCase()
          setSearchResults(all.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8))
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false))
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (!notifOpen) return
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [notifOpen])

  const openNotifications = () => {
    setNotifOpen((v) => !v)
  }

  const markRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    setUnreadCount((c) => Math.max(0, c - 1))
    fetch(`/api/notifications/${id}`, { method: "PATCH" }).catch(() => {})
  }

  const goToCampaign = (id: string) => {
    setShowSearch(false)
    setQuery("")
    router.push(`/dashboard/campaigns/${id}`)
  }

  return (
    <header
      className="h-[52px] flex items-center justify-between px-4 shrink-0 border-b border-[#DDE1E7]"
      style={{
        background: 'linear-gradient(180deg, #ffffff 0%, #f8f9fb 100%)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 1px 4px rgba(0,0,0,0.05)',
      }}
    >
      <div className="flex items-center gap-3">
        {title && (
          <h1 className="text-[15px] font-semibold text-[#111827] tracking-tight">{title}</h1>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {/* Search */}
        <div className="relative">
          {showSearch ? (
            <div className="flex items-center gap-2 h-8 px-3 rounded-[8px] w-[220px] sku-input">
              <Search size={13} className="text-[#9CA3AF] shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search campaigns…"
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setShowSearch(false); setQuery("") }
                  if (e.key === "Enter" && searchResults[0]) goToCampaign(searchResults[0].id)
                }}
                className="flex-1 bg-transparent text-[12.5px] text-[#111827] placeholder-[#9CA3AF] outline-none"
              />
              {searching && <Loader2 size={12} className="animate-spin text-[#9CA3AF]" />}
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
            </button>
          )}

          {showSearch && query.trim() && (
            <div
              className="absolute top-full right-0 mt-1 w-[280px] rounded-[10px] border border-[#DDE1E7] z-20 overflow-hidden max-h-[280px] overflow-y-auto"
              style={{ background: "linear-gradient(145deg, #ffffff 0%, #f8f9fb 100%)", boxShadow: "0 4px 16px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)" }}
            >
              {searching ? (
                <div className="p-4 text-center text-[12px] text-[#9CA3AF]">Searching…</div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-center text-[12px] text-[#9CA3AF]">No campaigns match "{query}"</div>
              ) : (
                searchResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => goToCampaign(c.id)}
                    className="w-full text-left px-3 py-2 text-[12.5px] text-[#374151] hover:bg-[#F0F2F5] transition-colors flex items-center justify-between"
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="text-[10px] text-[#9CA3AF] shrink-0 ml-2">{c.platform}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Feedback */}
        <button
          onClick={() => window.dispatchEvent(new Event("growzzy:open-feedback"))}
          className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[#9CA3AF] hover:text-[#374151] transition-colors sku-btn"
          aria-label="Feedback"
          title="Feedback"
        >
          <MessageSquare size={15} />
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={openNotifications}
            className="relative w-8 h-8 flex items-center justify-center rounded-[8px] text-[#9CA3AF] hover:text-[#374151] transition-colors sku-btn"
            aria-label="Notifications"
          >
            <Bell size={15} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#1F57F5] rounded-full" />
            )}
          </button>
          {notifOpen && (
            <div
              className="absolute top-full right-0 mt-1 w-[300px] rounded-[10px] border border-[#DDE1E7] z-20 overflow-hidden max-h-[360px] overflow-y-auto"
              style={{ background: "linear-gradient(145deg, #ffffff 0%, #f8f9fb 100%)", boxShadow: "0 4px 16px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)" }}
            >
              <div className="px-3 py-2 border-b border-[#E9EBEF] text-[12px] font-semibold text-[#374151]">Notifications</div>
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-[12px] text-[#9CA3AF]">No notifications yet</div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className="w-full text-left px-3 py-2.5 border-b border-[#F0F2F5] last:border-0 hover:bg-[#F8F9FB] transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      {!n.isRead && <span className="w-1.5 h-1.5 mt-1.5 bg-[#1F57F5] rounded-full shrink-0" />}
                      <div className={n.isRead ? "opacity-60" : ""}>
                        <p className="text-[12.5px] font-semibold text-[#111827]">{n.title}</p>
                        <p className="text-[11.5px] text-[#6B7280] mt-0.5">{n.body}</p>
                        <p className="text-[10.5px] text-[#9CA3AF] mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* New campaign CTA */}
        <Link
          href="/dashboard/campaigns/new"
          className="flex items-center gap-1.5 h-8 px-3.5 text-white text-[12.5px] font-semibold rounded-[8px] transition-colors sku-btn-primary"
        >
          <Plus size={13} />
          New Campaign
        </Link>
      </div>
    </header>
  )
}
