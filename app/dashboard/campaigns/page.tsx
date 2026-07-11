"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Archive, ChevronDown, ChevronRight, Copy, DollarSign, Pause, Play, Search, SlidersHorizontal } from "lucide-react"
import { toast } from "sonner"
import DashboardLayout from "@/components/dashboard-layout"
import { EmptyState } from "@/components/EmptyState"
import { PlatformIcon } from "@/components/platform-icon"
import { StatusBadge } from "@/components/status-badge"

type AccountOption = {
  externalId: string
  name?: string | null
  platform: string
  integrationName?: string | null
  lastSyncedAt?: string | null
}

type LatestChange = {
  id: string
  type: string
  status?: string | null
  apiSuccess?: boolean | null
  appliedAt: string
  previousValue?: string | null
  appliedValue?: string | null
  source?: string | null
}

type LayerRow = {
  id: string
  name: string
  status?: string | null
  budgetAmount?: number | null
  _count?: { keywords?: number; ads?: number }
}

type Campaign = {
  id: string
  name: string
  platform?: string | null
  adAccountId?: string | null
  status?: string | null
  liveStatus?: string | null
  objective?: string | null
  goal?: string | null
  budgetAmount?: number | null
  budget?: number | null
  spend?: number | null
  impressions?: number | null
  clicks?: number | null
  conversions?: number | null
  ctr?: number | null
  cpc?: number | null
  cpa?: number | null
  roas?: number | null
  verifiedAt?: string | null
  syncedAt?: string | null
  adGroups?: LayerRow[]
  adSets?: LayerRow[]
  latestChanges?: LatestChange[]
  preflight?: {
    canMutate: boolean
    code?: string | null
    remediationChecklist?: string[]
  }
}

type AdsManagerTrust = {
  source?: string
  emptyMessage?: string
  hasStaleData?: boolean
  selectedFilters?: Record<string, string | number | boolean>
}

const money = (value?: number | null) => `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
const pct = (value?: number | null) => `${Number(value || 0).toFixed(2)}%`
const roas = (value?: number | null) => `${Number(value || 0).toFixed(2)}x`
const normalizeStatus = (status?: string | null) => (status || "DRAFT").toUpperCase()

function relativeTime(value?: string | null) {
  if (!value) return "Never"
  const diff = Date.now() - new Date(value).getTime()
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.max(1, Math.round(diff / 60_000))}m ago`
  if (diff < 86_400_000) return `${Math.max(1, Math.round(diff / 3_600_000))}h ago`
  return `${Math.max(1, Math.round(diff / 86_400_000))}d ago`
}

function actionLabel(action: string) {
  return action.replaceAll("_", " ").toLowerCase()
}

export default function CampaignsPage() {
  const CAMPAIGNS_CACHE_KEY = "growzzy_ads_manager_cache_v1"
  const CAMPAIGNS_CACHE_TTL_MS = 60_000
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [selectedAdAccountId, setSelectedAdAccountId] = useState<string>("")
  const [trust, setTrust] = useState<AdsManagerTrust>({})
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [platformFilter, setPlatformFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [objectiveFilter, setObjectiveFilter] = useState("ALL")
  const [liveStatusFilter, setLiveStatusFilter] = useState("ALL")
  const [minSpendFilter, setMinSpendFilter] = useState("")
  const [maxSpendFilter, setMaxSpendFilter] = useState("")
  const [minRoasFilter, setMinRoasFilter] = useState("")
  const [maxRoasFilter, setMaxRoasFilter] = useState("")
  const [staleOnly, setStaleOnly] = useState(false)
  const [verifiedOnly, setVerifiedOnly] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [syncing, setSyncing] = useState(false)
  const [actingIds, setActingIds] = useState<Set<string>>(new Set())
  const campaignsLoadInFlightRef = useRef(false)
  const campaignsLoadKeyRef = useRef("")

  useEffect(() => {
    const search = searchParams.get("search") || ""
    setQuery(search)
    setDebouncedQuery(search)
    setPlatformFilter(searchParams.get("platform") || "ALL")
    setStatusFilter(searchParams.get("status") || "ALL")
    setObjectiveFilter(searchParams.get("objective") || "ALL")
    setLiveStatusFilter(searchParams.get("liveStatus") || "ALL")
    setMinSpendFilter(searchParams.get("minSpend") || "")
    setMaxSpendFilter(searchParams.get("maxSpend") || "")
    setMinRoasFilter(searchParams.get("minRoas") || "")
    setMaxRoasFilter(searchParams.get("maxRoas") || "")
    setStaleOnly(searchParams.get("staleOnly") === "1")
    setVerifiedOnly(searchParams.get("verifiedOnly") !== "0")
  }, [searchParams])

  useEffect(() => {
    const params = new URLSearchParams()
    if (query) params.set("search", query)
    if (selectedAdAccountId) params.set("adAccountId", selectedAdAccountId)
    if (platformFilter !== "ALL") params.set("platform", platformFilter)
    if (statusFilter !== "ALL") params.set("status", statusFilter)
    if (objectiveFilter !== "ALL") params.set("objective", objectiveFilter)
    if (liveStatusFilter !== "ALL") params.set("liveStatus", liveStatusFilter)
    if (minSpendFilter) params.set("minSpend", minSpendFilter)
    if (maxSpendFilter) params.set("maxSpend", maxSpendFilter)
    if (minRoasFilter) params.set("minRoas", minRoasFilter)
    if (maxRoasFilter) params.set("maxRoas", maxRoasFilter)
    if (staleOnly) params.set("staleOnly", "1")
    if (!verifiedOnly) params.set("verifiedOnly", "0")
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [
    query,
    selectedAdAccountId,
    platformFilter,
    statusFilter,
    objectiveFilter,
    liveStatusFilter,
    minSpendFilter,
    maxSpendFilter,
    minRoasFilter,
    maxRoasFilter,
    staleOnly,
    verifiedOnly,
    router,
    pathname,
  ])

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 300)
    return () => window.clearTimeout(timeout)
  }, [query])

  const loadCampaigns = useCallback(async (force = false) => {
    const loadKey = JSON.stringify({
      selectedAdAccountId,
      platformFilter,
      statusFilter,
      objectiveFilter,
      liveStatusFilter,
      minSpendFilter,
      maxSpendFilter,
      minRoasFilter,
      maxRoasFilter,
      staleOnly,
      verifiedOnly,
    })
    if (!force && campaignsLoadInFlightRef.current) return
    if (!force && campaignsLoadKeyRef.current === loadKey) return
    campaignsLoadInFlightRef.current = true
    campaignsLoadKeyRef.current = loadKey
    setLoading(true)
    try {
      if (!force) {
        try {
          const raw = window.sessionStorage.getItem(CAMPAIGNS_CACHE_KEY)
          if (raw) {
            const cached = JSON.parse(raw) as { at: number; key: string; value: { campaigns: Campaign[]; accounts: AccountOption[]; trust: AdsManagerTrust; selectedAdAccountId?: string | null } }
            if (cached?.value && cached.key === loadKey && Date.now() - Number(cached.at || 0) <= CAMPAIGNS_CACHE_TTL_MS) {
              setCampaigns(cached.value.campaigns || [])
              setAccounts(cached.value.accounts || [])
              setTrust(cached.value.trust || {})
              if (!selectedAdAccountId && cached.value.selectedAdAccountId) setSelectedAdAccountId(cached.value.selectedAdAccountId)
              setLoading(false)
            }
          }
        } catch {}
      }
      const params = new URLSearchParams()
      if (selectedAdAccountId) params.set("adAccountId", selectedAdAccountId)
      if (platformFilter !== "ALL") params.set("platform", platformFilter)
      if (statusFilter !== "ALL") params.set("status", statusFilter)
      if (objectiveFilter !== "ALL") params.set("objective", objectiveFilter)
      if (liveStatusFilter !== "ALL") params.set("liveStatus", liveStatusFilter)
      if (minSpendFilter) params.set("minSpend", minSpendFilter)
      if (maxSpendFilter) params.set("maxSpend", maxSpendFilter)
      if (minRoasFilter) params.set("minRoas", minRoasFilter)
      if (maxRoasFilter) params.set("maxRoas", maxRoasFilter)
      if (staleOnly) params.set("staleOnly", "1")
      if (!verifiedOnly) params.set("verifiedOnly", "0")
      const response = await fetch(`/api/ads-manager${params.size ? `?${params}` : ""}`)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Could not load Ads Manager")
      setCampaigns(data.campaigns || [])
      setAccounts(data.accounts || [])
      setTrust(data.trust || {})
      if (!selectedAdAccountId && data.selectedAdAccountId) setSelectedAdAccountId(data.selectedAdAccountId)
      try {
        window.sessionStorage.setItem(
          CAMPAIGNS_CACHE_KEY,
          JSON.stringify({
            at: Date.now(),
            key: loadKey,
            value: {
              campaigns: data.campaigns || [],
              accounts: data.accounts || [],
              trust: data.trust || {},
              selectedAdAccountId: data.selectedAdAccountId || null,
            },
          })
        )
      } catch {}
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ads Manager failed to load")
    } finally {
      campaignsLoadInFlightRef.current = false
      setLoading(false)
    }
  }, [
    selectedAdAccountId,
    platformFilter,
    statusFilter,
    objectiveFilter,
    liveStatusFilter,
    minSpendFilter,
    maxSpendFilter,
    minRoasFilter,
    maxRoasFilter,
    staleOnly,
    verifiedOnly,
  ])

  useEffect(() => {
    const onWorkspaceChanged = () => {
      void loadCampaigns(true)
    }
    const onSyncComplete = () => {
      void loadCampaigns(true)
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadCampaigns()
    }
    void loadCampaigns(true)
    window.addEventListener("growzzy:workspace-changed", onWorkspaceChanged)
    window.addEventListener("growzzy:sync-complete", onSyncComplete)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener("growzzy:workspace-changed", onWorkspaceChanged)
      window.removeEventListener("growzzy:sync-complete", onSyncComplete)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [loadCampaigns])

  const counts = useMemo(() => {
    const active = campaigns.filter((campaign) => ["ACTIVE", "ENABLED"].includes(normalizeStatus(campaign.status))).length
    const paused = campaigns.filter((campaign) => normalizeStatus(campaign.status) === "PAUSED").length
    const removed = campaigns.filter((campaign) => ["REMOVED", "ARCHIVED"].includes(normalizeStatus(campaign.status))).length
    return { all: campaigns.length, active, paused, removed }
  }, [campaigns])

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((campaign) => {
      const matchesSearch = !debouncedQuery || campaign.name.toLowerCase().includes(debouncedQuery)
      const matchesPlatform = platformFilter === "ALL" || (campaign.platform || "").toUpperCase() === platformFilter
      const currentStatus = normalizeStatus(campaign.status)
      const matchesStatus =
        statusFilter === "ALL" ||
        currentStatus === statusFilter ||
        (statusFilter === "ACTIVE" && currentStatus === "ENABLED") ||
        (statusFilter === "REMOVED" && currentStatus === "ARCHIVED")
      return matchesSearch && matchesPlatform && matchesStatus
    })
  }, [campaigns, debouncedQuery, platformFilter, statusFilter])

  const toggleSelected = (campaignId: string) => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(campaignId)) next.delete(campaignId)
      else next.add(campaignId)
      return next
    })
  }

  const toggleExpanded = (campaignId: string) => {
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(campaignId)) next.delete(campaignId)
      else next.add(campaignId)
      return next
    })
  }

  const bulkAction = async (action: "PAUSE" | "RESUME" | "REMOVE" | "INCREASE_BUDGET" | "DECREASE_BUDGET", percent?: number) => {
    if (!selected.size) return
    const selectedCampaigns = campaigns.filter((campaign) => selected.has(campaign.id))
    const blocked = selectedCampaigns.filter((campaign) => campaign.preflight?.canMutate === false)
    if (blocked.length > 0) {
      const first = blocked[0]
      const reason = first.preflight?.code ? ` (${first.preflight.code})` : ""
      const checklist = (first.preflight?.remediationChecklist || []).join(" ")
      toast.error(`Bulk action blocked${reason}. ${checklist || "Resolve preflight checklist and retry."}`)
      return
    }
    if (["REMOVE", "INCREASE_BUDGET", "DECREASE_BUDGET"].includes(action)) {
      const message =
        action === "REMOVE"
          ? "Remove selected campaigns in the live ad platform first?"
          : `${action === "INCREASE_BUDGET" ? "Increase" : "Decrease"} selected campaign budgets by ${percent || 10}% in the live platform first?`
      if (!window.confirm(message)) return
    }
    try {
      const response = await fetch("/api/ads-manager/bulk-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), action, percent }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.ok) throw new Error(data.error || "Bulk action failed")
      toast.success(`${data.successCount || 0} platform action${data.successCount === 1 ? "" : "s"} applied`)
      if (data.failureCount) {
        const firstFailure = data.results?.find((result: { ok: boolean; error?: string; remediation?: string; code?: string; correlationId?: string }) => !result.ok)
        const correlation = firstFailure?.correlationId ? ` [${firstFailure.correlationId}]` : ""
        toast.error(
          firstFailure?.remediation
            ? `${firstFailure.error}${correlation} ${firstFailure.remediation}`
            : firstFailure?.error || `${data.failureCount} action${data.failureCount === 1 ? "" : "s"} failed`,
        )
      }
      setSelected(new Set())
      await loadCampaigns()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk action failed")
    }
  }

  const rowStatusAction = async (campaignId: string, status: "ENABLED" | "PAUSED" | "ARCHIVED") => {
    const campaign = campaigns.find((item) => item.id === campaignId)
    if (campaign?.preflight?.canMutate === false) {
      const reason = campaign.preflight.code ? ` (${campaign.preflight.code})` : ""
      const checklist = (campaign.preflight.remediationChecklist || []).join(" ")
      toast.error(`Action blocked${reason}. ${checklist || "Resolve preflight checklist and retry."}`)
      return
    }
    if (status === "ARCHIVED" && !window.confirm("Remove this campaign in the live ad platform first?")) return
    setActingIds((previous) => new Set(previous).add(campaignId))
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const correlation = data.correlationId ? ` [${data.correlationId}]` : ""
        throw new Error(data.remediation ? `${data.error}${correlation} ${data.remediation}` : data.error || "Platform status update failed")
      }
      toast.success(status === "ENABLED" ? "Campaign resumed in platform" : status === "PAUSED" ? "Campaign paused in platform" : "Campaign removed in platform")
      await loadCampaigns()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update live campaign")
    } finally {
      setActingIds((previous) => {
        const next = new Set(previous)
        next.delete(campaignId)
        return next
      })
    }
  }

  const syncNow = async () => {
    setSyncing(true)
    try {
      const response = await fetch("/api/integrations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "GOOGLE" }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Sync failed")
      toast.success(`Sync complete - ${data.importedCampaignCount ?? data.syncedCampaigns ?? data.campaignCount ?? data.campaignsUpdated ?? 0} campaigns updated`)
      window.dispatchEvent(new Event("growzzy:sync-complete"))
      await loadCampaigns()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sync campaigns")
    } finally {
      setSyncing(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Ads Manager</h1>
            <p className="text-sm text-slate-500">Verified live campaigns only. Platform changes happen first, then GROWZZY updates.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={syncNow} disabled={syncing} className="btn btn-secondary h-9 px-4 text-xs font-semibold">
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
            <Link href="/dashboard/campaigns/new" className="btn btn-primary h-9 px-4 text-xs font-semibold">
              New Campaign
            </Link>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-border bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search verified campaigns..."
                className="h-10 w-full rounded-lg border border-border bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-[#1F57F5] focus:bg-white"
              />
            </div>
          <div className="flex flex-wrap gap-2">
            <select value={selectedAdAccountId} onChange={(event) => setSelectedAdAccountId(event.target.value)} className="h-10 max-w-[240px] rounded-lg border border-border bg-white px-3 text-sm">
                {accounts.length === 0 ? <option value="">No connected ad accounts</option> : null}
                {accounts.map((account) => (
                  <option key={`${account.platform}-${account.externalId}`} value={account.externalId}>
                    {account.platform} - {account.name || account.externalId}
                  </option>
                ))}
              </select>
              <select value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value)} className="h-10 rounded-lg border border-border bg-white px-3 text-sm">
                <option value="ALL">All platforms</option>
                <option value="GOOGLE">Google</option>
                <option value="META">Meta gated</option>
              </select>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-lg border border-border bg-white px-3 text-sm">
                <option value="ALL">All ({counts.all})</option>
                <option value="ACTIVE">Active ({counts.active})</option>
                <option value="PAUSED">Paused ({counts.paused})</option>
                <option value="REMOVED">Removed ({counts.removed})</option>
              </select>
              <select value={objectiveFilter} onChange={(event) => setObjectiveFilter(event.target.value)} className="h-10 rounded-lg border border-border bg-white px-3 text-sm">
                <option value="ALL">All objectives</option>
                <option value="CONVERSIONS">Conversions</option>
                <option value="LEADS">Leads</option>
                <option value="TRAFFIC">Traffic</option>
                <option value="AWARENESS">Awareness</option>
              </select>
              <select value={liveStatusFilter} onChange={(event) => setLiveStatusFilter(event.target.value)} className="h-10 rounded-lg border border-border bg-white px-3 text-sm">
                <option value="ALL">All live states</option>
                <option value="LIVE_ENABLED">Live Enabled</option>
                <option value="LIVE_PAUSED">Live Paused</option>
                <option value="REMOVED">Removed</option>
                <option value="FAILED">Failed</option>
              </select>
              <button className="btn btn-secondary h-10 px-3 text-sm" title={trust.source || "Verified live platform sync only"}>
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Trust filter
              </button>
            </div>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-6">
            <input value={minSpendFilter} onChange={(event) => setMinSpendFilter(event.target.value)} placeholder="Min spend $" className="h-9 rounded-lg border border-border bg-white px-3 text-xs" />
            <input value={maxSpendFilter} onChange={(event) => setMaxSpendFilter(event.target.value)} placeholder="Max spend $" className="h-9 rounded-lg border border-border bg-white px-3 text-xs" />
            <input value={minRoasFilter} onChange={(event) => setMinRoasFilter(event.target.value)} placeholder="Min ROAS" className="h-9 rounded-lg border border-border bg-white px-3 text-xs" />
            <input value={maxRoasFilter} onChange={(event) => setMaxRoasFilter(event.target.value)} placeholder="Max ROAS" className="h-9 rounded-lg border border-border bg-white px-3 text-xs" />
            <label className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 text-xs">
              <input type="checkbox" checked={staleOnly} onChange={(event) => setStaleOnly(event.target.checked)} />
              stale only
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 text-xs">
              <input type="checkbox" checked={verifiedOnly} onChange={(event) => setVerifiedOnly(event.target.checked)} />
              verified only
            </label>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>{trust.source || "Verified live platform sync only"}</span>
            <span>Selected account: {selectedAdAccountId || "none"} - last sync {relativeTime(accounts.find((account) => account.externalId === selectedAdAccountId)?.lastSyncedAt)}</span>
          </div>
          {trust.hasStaleData && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Stale data detected (&gt;24h). Run Sync before risky apply actions.
            </div>
          )}

          {selected.size > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#1F57F5]/20 bg-[#1F57F5]/5 px-3 py-2 text-sm">
              <span className="font-medium text-[#1F57F5]">{selected.size} selected</span>
              <div className="flex flex-wrap gap-2">
                <button disabled={!!trust.hasStaleData} title={trust.hasStaleData ? "Sync required before bulk apply actions" : "Pause selected campaigns"} onClick={() => bulkAction("PAUSE")} className="btn btn-secondary h-8 px-3 text-xs disabled:opacity-50">Pause</button>
                <button disabled={!!trust.hasStaleData} title={trust.hasStaleData ? "Sync required before bulk apply actions" : "Resume selected campaigns"} onClick={() => bulkAction("RESUME")} className="btn btn-secondary h-8 px-3 text-xs disabled:opacity-50">Resume</button>
                <button disabled={!!trust.hasStaleData} title={trust.hasStaleData ? "Sync required before bulk apply actions" : "Decrease selected campaign budgets"} onClick={() => bulkAction("DECREASE_BUDGET", 10)} className="btn btn-secondary h-8 px-3 text-xs disabled:opacity-50">Budget -10%</button>
                <button disabled={!!trust.hasStaleData} title={trust.hasStaleData ? "Sync required before bulk apply actions" : "Increase selected campaign budgets"} onClick={() => bulkAction("INCREASE_BUDGET", 10)} className="btn btn-secondary h-8 px-3 text-xs disabled:opacity-50">Budget +10%</button>
                <button disabled={!!trust.hasStaleData} title={trust.hasStaleData ? "Sync required before bulk apply actions" : "Remove selected campaigns"} onClick={() => bulkAction("REMOVE")} className="btn btn-secondary h-8 px-3 text-xs text-red-600 disabled:opacity-50">Remove</button>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}
            </div>
          ) : campaigns.length === 0 ? (
            <EmptyState
              icon={<SlidersHorizontal className="h-10 w-10" />}
              title="No verified live campaigns synced"
              description={trust.emptyMessage || "Connect and sync Google Ads. Drafts, seed rows, and unverified campaigns are intentionally hidden here."}
              action={{ label: "Go to Ad Accounts", href: "/dashboard/accounts" }}
            />
          ) : filteredCampaigns.length === 0 ? (
            <EmptyState icon={<Search className="h-10 w-10" />} title={`No campaigns match "${query}"`} description="Try a different search term, ad account, platform, or status filter." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1280px] w-full text-left text-sm">
                <thead className="border-b border-border bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="w-10 px-4 py-3"> </th>
                    <th className="px-3 py-3">Name</th>
                    <th className="px-3 py-3">Platform</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Objective</th>
                    <th className="px-3 py-3 text-right">Budget</th>
                    <th className="px-3 py-3 text-right">Spend</th>
                    <th className="px-3 py-3 text-right">ROAS</th>
                    <th className="px-3 py-3 text-right">CPA</th>
                    <th className="px-3 py-3 text-right">CTR</th>
                    <th className="px-3 py-3">Latest change</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCampaigns.map((campaign) => {
                    const campaignStatus = normalizeStatus(campaign.status)
                    const isOpen = expanded.has(campaign.id)
                    const layers = [...(campaign.adGroups || []), ...(campaign.adSets || [])]
                    const latest = campaign.latestChanges?.[0]
                    const isActing = actingIds.has(campaign.id)
                    const preflightBlocked = !campaign.preflight?.canMutate
                    const remediation = campaign.preflight?.remediationChecklist || []
                    return (
                      <Fragment key={campaign.id}>
                        <tr className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <input type="checkbox" checked={selected.has(campaign.id)} onChange={() => toggleSelected(campaign.id)} className="h-4 w-4 rounded border-slate-300" />
                              <button onClick={() => toggleExpanded(campaign.id)} className="rounded p-1 text-slate-500 hover:bg-slate-100" title="Show campaign hierarchy">
                                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-semibold text-slate-950">{campaign.name}</div>
                            <div className="text-xs text-slate-500">Verified {relativeTime(campaign.verifiedAt || campaign.syncedAt)} - {campaign.liveStatus || "LIVE"}</div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <PlatformIcon platform={(campaign.platform || "GOOGLE").toUpperCase()} className="h-5 w-5" />
                              <span className="text-xs font-medium">{campaign.platform || "GOOGLE"}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3"><StatusBadge status={campaignStatus} /></td>
                          <td className="px-3 py-3 text-slate-600">{campaign.objective || campaign.goal || "Conversions"}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{money(campaign.budgetAmount || campaign.budget)}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{money(campaign.spend)}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{roas(campaign.roas)}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{money(campaign.cpa || campaign.cpc)}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{pct(campaign.ctr)}</td>
                          <td className="px-3 py-3 text-xs text-slate-500">
                            {latest ? `${actionLabel(latest.type)} - ${relativeTime(latest.appliedAt)}` : "No changes yet"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <button disabled={isActing || preflightBlocked} title={preflightBlocked ? "Preflight blocked - see checklist below" : "Resume in platform"} onClick={() => rowStatusAction(campaign.id, "ENABLED")} className="rounded-md border p-1.5 hover:bg-slate-50 disabled:opacity-50"><Play className="h-3.5 w-3.5" /></button>
                              <button disabled={isActing || preflightBlocked} title={preflightBlocked ? "Preflight blocked - see checklist below" : "Pause in platform"} onClick={() => rowStatusAction(campaign.id, "PAUSED")} className="rounded-md border p-1.5 hover:bg-slate-50 disabled:opacity-50"><Pause className="h-3.5 w-3.5" /></button>
                              <button title="Duplicate draft (coming next)" className="rounded-md border p-1.5 opacity-60" disabled><Copy className="h-3.5 w-3.5" /></button>
                              <button disabled={isActing || preflightBlocked} title={preflightBlocked ? "Preflight blocked - see checklist below" : "Remove in platform"} onClick={() => rowStatusAction(campaign.id, "ARCHIVED")} className="rounded-md border p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50"><Archive className="h-3.5 w-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={12} className="bg-slate-50 px-16 py-3">
                              <ExpandedCampaign campaign={campaign} layers={layers} latestChanges={campaign.latestChanges || []} remediation={remediation} onRetry={rowStatusAction} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

function ExpandedCampaign({
  campaign,
  layers,
  latestChanges,
  remediation,
  onRetry,
}: {
  campaign: Campaign
  layers: LayerRow[]
  latestChanges: LatestChange[]
  remediation: string[]
  onRetry: (campaignId: string, status: "ENABLED" | "PAUSED" | "ARCHIVED") => Promise<void>
}) {
  const [timelineFilter, setTimelineFilter] = useState<"ALL" | "SUCCESS" | "FAILED" | "AI" | "BULK">("ALL")
  const rows = latestChanges.filter((change) => {
    if (timelineFilter === "SUCCESS") return change.apiSuccess !== false
    if (timelineFilter === "FAILED") return change.apiSuccess === false || change.status === "FAILED"
    if (timelineFilter === "AI") return change.type.includes("AI") || change.type.includes("OPTIMIZATION")
    if (timelineFilter === "BULK") return change.type.includes("BULK")
    return true
  })
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
      <div className="rounded-lg border bg-white">
        {layers.length ? (
          layers.map((layer) => (
            <div key={layer.id} className="flex items-center justify-between border-b px-4 py-3 last:border-b-0">
              <div>
                <div className="text-sm font-semibold">{layer.name}</div>
                <div className="text-xs text-slate-500">
                  {layer._count?.keywords ?? 0} keywords - {layer._count?.ads ?? 0} ads {layer.budgetAmount ? `- ${money(layer.budgetAmount)} budget` : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-secondary h-8 px-3 text-xs" disabled title="Opening keyword planner is next">Add Keywords</button>
                <button className="btn btn-secondary h-8 px-3 text-xs" disabled title="Opening ad builder is next">Add Ad</button>
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-slate-500">No synced ad groups/ad sets found for this campaign.</span>
            <Link href={`/dashboard/campaigns/new?campaignId=${campaign.id}`} className="btn btn-secondary h-8 px-3 text-xs">Complete hierarchy</Link>
          </div>
        )}
      </div>
      <div className="rounded-lg border bg-white p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <DollarSign className="h-4 w-4 text-emerald-600" />
          Latest platform activity
        </div>
        {!!remediation.length && (
          <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            <div className="mb-1 font-semibold">Preflight checklist</div>
            <ul className="list-disc space-y-0.5 pl-4">
              {remediation.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="mb-2 flex flex-wrap gap-1">
          {(["ALL", "SUCCESS", "FAILED", "AI", "BULK"] as const).map((chip) => (
            <button key={chip} onClick={() => setTimelineFilter(chip)} className={`rounded-full px-2 py-0.5 text-[10px] ${timelineFilter === chip ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
              {chip}
            </button>
          ))}
        </div>
        {rows.length ? (
          <div className="space-y-2">
            {rows.map((change) => (
              <div key={change.id} className="rounded-md bg-slate-50 p-2 text-xs">
                <div className="font-semibold">{actionLabel(change.type)} {change.apiSuccess === false ? "• failed" : "• success"}</div>
                <div className="text-slate-500">{change.previousValue || "n/a"} {"->"} {change.appliedValue || "n/a"} - {relativeTime(change.appliedAt)}</div>
                {change.apiSuccess === false && (change.type.includes("PAUSE") || change.type.includes("RESUME")) ? (
                  <div className="mt-1">
                    <button
                      onClick={() => onRetry(campaign.id, change.type.includes("PAUSE") ? "PAUSED" : "ENABLED")}
                      className="rounded border border-border bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-100"
                      title="Retry this safe action with preflight check"
                    >
                      Retry safe action
                    </button>
                  </div>
                ) : null}
                <div className="text-[10px] text-slate-400">source: {change.source || (change.type.includes("BULK") ? "bulk" : "ai/manual")} - ref: {change.id}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No GROWZZY actions logged yet. AI and bulk actions will appear here.</p>
        )}
      </div>
    </div>
  )
}
