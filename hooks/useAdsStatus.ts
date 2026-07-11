"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type PlatformStatus = {
  connected: boolean
  hasAdsAccess: boolean
  status: string
  adAccounts: {
    id: string
    externalId: string
    name: string
    currencyCode: string | null
    isPrimary: boolean
    syncStatus: string | null
    lastSyncedAt: string | null
  }[]
  primaryAccount: {
    id: string
    name: string
    syncStatus: string | null
    lastSyncedAt: string | null
  } | null
  connectedAt: string
} | null

export type AdsStatusResult = {
  google: PlatformStatus
  meta: PlatformStatus
  hasAnyAdsAccess: boolean
  isLoading: boolean
  lastUpdated: Date | null
  refetch: () => Promise<void>
  googleConnectedNoAds: boolean
  metaConnectedNoAds: boolean
}

export function useAdsStatus(): AdsStatusResult {
  const CACHE_KEY = "growzzy_ads_status_cache_v1"
  const CACHE_TTL_MS = 60_000
  const [data, setData] = useState<{
    google: PlatformStatus
    meta: PlatformStatus
    hasAnyAdsAccess: boolean
  }>({
    google: null,
    meta: null,
    hasAnyAdsAccess: false,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const inFlightRef = useRef(false)
  const lastFetchMsRef = useRef(0)

  const fetchStatus = useCallback(async (force = false) => {
    const now = Date.now()
    if (!force && (inFlightRef.current || now - lastFetchMsRef.current < 15_000)) return
    inFlightRef.current = true
    try {
      const res = await fetch("/api/integrations/status")
      const d = await res.json()
      if (res.ok) {
        setData(d)
        setLastUpdated(new Date())
        lastFetchMsRef.current = now
        try {
          window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), value: d }))
        } catch {}
      }
    } catch {
      setData((current) => ({
        google: current.google,
        meta: current.meta,
        hasAnyAdsAccess: current.hasAnyAdsAccess,
      }))
    } finally {
      inFlightRef.current = false
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(CACHE_KEY)
      if (raw) {
        const cached = JSON.parse(raw) as { at: number; value: { google: PlatformStatus; meta: PlatformStatus; hasAnyAdsAccess: boolean } }
        if (cached?.value && Date.now() - Number(cached.at || 0) <= CACHE_TTL_MS) {
          setData(cached.value)
          setLastUpdated(new Date(Number(cached.at || Date.now())))
          setIsLoading(false)
        }
      }
    } catch {}

    void fetchStatus(true)
    const interval = window.setInterval(fetchStatus, 120_000)
    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchStatus()
    }
    const onSync = () => void fetchStatus(true)
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("growzzy:sync-complete", onSync)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("growzzy:sync-complete", onSync)
    }
  }, [fetchStatus])

  return {
    ...data,
    isLoading,
    lastUpdated,
    refetch: fetchStatus,
    googleConnectedNoAds: !!(data.google?.connected && !data.google?.hasAdsAccess),
    metaConnectedNoAds: !!(data.meta?.connected && !data.meta?.hasAdsAccess),
  }
}
