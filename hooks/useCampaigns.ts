"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export function useCampaigns(platform?: string) {
  const CACHE_KEY = `growzzy_campaigns_cache_${platform || "all"}`
  const CACHE_TTL_MS = 60_000
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const inFlightRef = useRef(false)
  const lastFetchMsRef = useRef(0)

  const refetch = useCallback(async (force = false) => {
    const now = Date.now()
    if (!force && (inFlightRef.current || now - lastFetchMsRef.current < 20_000)) return
    if (!force) {
      try {
        const raw = window.sessionStorage.getItem(CACHE_KEY)
        if (raw) {
          const cached = JSON.parse(raw) as { at: number; value: any[] }
          if (Array.isArray(cached?.value) && Date.now() - Number(cached.at || 0) <= CACHE_TTL_MS) {
            setCampaigns(cached.value)
            setIsLoading(false)
          }
        }
      } catch {}
    }
    inFlightRef.current = true
    try {
      const query = platform ? `?platform=${encodeURIComponent(platform)}` : ""
      const res = await fetch(`/api/campaigns${query}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Failed to load campaigns")
      setCampaigns(json?.data?.campaigns || json?.campaigns || [])
      setError(null)
      setLastUpdated(new Date())
      lastFetchMsRef.current = now
      try {
        window.sessionStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ at: Date.now(), value: json?.data?.campaigns || json?.campaigns || [] })
        )
      } catch {}
    } catch (err: any) {
      setError(err?.message || "Failed to load campaigns")
    } finally {
      inFlightRef.current = false
      setIsLoading(false)
    }
  }, [platform])

  useEffect(() => {
    void refetch(true)
    const interval = window.setInterval(refetch, 180_000)
    const onVisible = () => {
      if (document.visibilityState === "visible") void refetch()
    }
    const onSync = () => void refetch(true)
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("growzzy:sync-complete", onSync)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("growzzy:sync-complete", onSync)
    }
  }, [refetch])

  return { campaigns, isLoading, error, lastUpdated, refetch }
}
