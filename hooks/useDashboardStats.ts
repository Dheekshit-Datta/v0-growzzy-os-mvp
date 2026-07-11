"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type PlatformKey = "GOOGLE" | "META"

export type PlatformStats = {
  spend: number
  impressions: number
  clicks: number
  conversions: number
  avgRoas: number
  campaigns: number
} | null

export type DashboardStats = {
  connections?: Partial<Record<PlatformKey, {
    platform: PlatformKey
    integrationId: string
    hasAdsAccess: boolean
    hasAdsAccount?: boolean
    selectedAdAccountId: string | null
    hasSelectedAdAccount?: boolean
    lastSyncedAt: string | null
    status: string | null
  } | null>>
  connectedPlatforms: PlatformKey[]
  connectedAccountPlatforms?: PlatformKey[]
  selectedAdAccountId?: string | null
  hasAnyConnectedAccount?: boolean
  totals: {
    spend: number
    impressions: number
    clicks: number
    conversions: number
    avgRoas: number
    avgCtr: number
    avgCpc: number
  }
  byPlatform: Record<PlatformKey, PlatformStats>
  hasCampaignData: boolean
  totalSpend: number
  totalImpressions: number
  totalClicks: number
  totalConversions: number
  avgRoas: number
  avgCtr: number
  avgCpc: number
  kpis?: {
    spend: { current: number; previous: number; changePercent: number }
    impressions: { current: number; previous: number; changePercent: number }
    conversions: { current: number; previous: number; changePercent: number }
    roas: { current: number; previous: number; changePercent: number }
  }
  spendByDay: { date: string; spend: number }[]
  topCampaigns: Array<{ id: string; name: string; status: string; spend: number; impressions: number; conversions: number; roas: number }>
  lastSyncedAt: string | null
  isStale?: boolean
}

export function useDashboardStats() {
  const CACHE_KEY = "growzzy_dashboard_stats_cache_v1"
  const CACHE_TTL_MS = 60_000
  const [data, setData] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const lastFetchMsRef = useRef(0)
  const inFlightRef = useRef(false)

  const runFetch = useCallback(async (force = false) => {
    const now = Date.now()
    if (!force && (inFlightRef.current || now - lastFetchMsRef.current < 20_000)) return
    inFlightRef.current = true
    try {
      const res = await fetch("/api/dashboard/stats")
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Failed to load dashboard stats")
      setData(json)
      setError(null)
      setLastUpdated(new Date())
      lastFetchMsRef.current = now
      try {
        window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), value: json }))
      } catch {}
    } catch (err: any) {
      setError(err?.message || "Failed to load dashboard stats")
    } finally {
      inFlightRef.current = false
      setIsLoading(false)
    }
  }, [])

  const refetch = useCallback(async () => {
    await runFetch(false)
  }, [runFetch])

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(CACHE_KEY)
      if (raw) {
        const cached = JSON.parse(raw) as { at: number; value: DashboardStats }
        if (cached?.value && Date.now() - Number(cached.at || 0) <= CACHE_TTL_MS) {
          setData(cached.value)
          setIsLoading(false)
          setLastUpdated(new Date(Number(cached.at || Date.now())))
        }
      }
    } catch {}

    runFetch(true)
    const interval = window.setInterval(refetch, 180_000)
    const onVisible = () => {
      if (document.visibilityState === "visible") void refetch()
    }
    const onSync = () => void runFetch(true)
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("growzzy:sync-complete", onSync)
    window.addEventListener("growzzy:workspace-changed", onSync)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("growzzy:sync-complete", onSync)
      window.removeEventListener("growzzy:workspace-changed", onSync)
    }
  }, [refetch, runFetch])

  return { data, isLoading, error, lastUpdated, refetch }
}
