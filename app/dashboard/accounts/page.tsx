"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { EmptyState } from "@/components/EmptyState"
import { PlatformIcon } from "@/components/platform-icon"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Plug, Plus, RefreshCw, Building2 } from "lucide-react"
import { toast } from "sonner"
import { AdAccountSelectorDialog } from "@/components/growzzy/ad-account-selector-dialog"

type Provider = "google"

type IntegrationStatus = {
  id?: string
  status?: string
  hasAdsAccount?: boolean
  hasAdsAccess?: boolean
  adAccountId?: string | null
  adAccountName?: string | null
  lastSynced?: string | null
  lastSyncStatus?: string | null
  lastSyncError?: string | null
}

type DashboardStatsResponse = {
  byPlatform?: Record<string, { spend?: number | null } | null>
}

const platforms: Array<{ id: Provider; name: string }> = [
  { id: "google", name: "Google Ads" },
]

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0)

export default function AccountsPage() {
  const [integrations, setIntegrations] = useState<Record<string, IntegrationStatus>>({})
  const [platformSpend, setPlatformSpend] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [selectAccountPlatform, setSelectAccountPlatform] = useState<"google" | "meta" | null>(null)
  const loadStateRef = useRef({ inFlight: false, lastRunAt: 0 })
  const connected = useMemo(
    () => platforms.filter((platform) => Boolean(integrations[platform.id]?.hasAdsAccount || integrations[platform.id]?.adAccountId)),
    [integrations]
  )

  const load = useCallback(async (force = false) => {
    const now = Date.now()
    if (loadStateRef.current.inFlight) return
    if (!force && now - loadStateRef.current.lastRunAt < 8000) return
    loadStateRef.current.inFlight = true
    setLoading(true)
    try {
      const [response, statsResponse] = await Promise.all([
        fetch("/api/integrations"),
        fetch("/api/dashboard/stats"),
      ])
      const data = await response.json()
      setIntegrations(data.integrations || {})
      if (statsResponse.ok) {
        const stats = (await statsResponse.json()) as DashboardStatsResponse
        const byPlatform = stats.byPlatform || {}
        setPlatformSpend({
          google: Number(byPlatform.GOOGLE?.spend || 0),
        })
      } else {
        setPlatformSpend({})
      }
    } catch {
      toast.error("Could not load ad accounts")
    } finally {
      loadStateRef.current.inFlight = false
      loadStateRef.current.lastRunAt = Date.now()
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(true)
  }, [load])

  const connect = async (platform: Provider) => {
    window.location.href = `/api/integrations/${platform}/connect`
  }

  const sync = async (platform: Provider) => {
    try {
      const response = await fetch("/api/integrations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      })
      const data = await response.json()
      if (!response.ok || data.success === false) throw new Error(data.error || "Sync failed")
      toast.success(`Synced ${data.syncedCampaigns || data.campaignCount || 0} campaigns`)
      window.dispatchEvent(new Event("growzzy:sync-complete"))
      await load()
    } catch (error: any) {
      toast.error(error.message || "Sync failed")
    }
  }

  const disconnect = async (platform: Provider) => {
    if (!confirm(`Disconnect ${platform}? Synced campaign data for this platform will be removed.`)) return
    try {
      const response = await fetch("/api/integrations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: platform }),
      })
      if (!response.ok) throw new Error("Disconnect failed")
      toast.success("Account disconnected")
      await load()
    } catch (error: any) {
      toast.error(error.message || "Disconnect failed")
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ad Accounts</h1>
            <p className="mt-1 text-sm text-muted-foreground">{connected.length} connected accounts</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Connect Account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Connect a platform</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                {platforms.map((platform) => (
                  <button
                    key={platform.id}
                    onClick={() => connect(platform.id)}
                    className="relative flex flex-col items-center gap-3 rounded-lg border-2 p-5 hover:border-primary/40"
                  >
                    <PlatformIcon platform={platform.id} className="h-10 w-10" />
                    <span className="text-sm font-semibold">{platform.name}</span>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-48 rounded-lg" />)}
          </div>
        ) : connected.length === 0 ? (
          <EmptyState icon={<Plug className="h-10 w-10" />} title="No ad accounts connected" description="Connect Google Ads to start syncing campaigns and metrics." action={{ label: "Connect Account", onClick: () => setOpen(true) }} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {platforms.map((platform) => {
              const integration = integrations[platform.id]
              const hasAccount = !!integration?.adAccountId || integration?.hasAdsAccount === true
              const hasAdsAccess = integration?.hasAdsAccess === true
              const isConnected = hasAccount
              return (
                <div key={platform.id} className="rounded-lg border bg-card p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <PlatformIcon platform={platform.id} className="h-8 w-8" />
                      <div>
                        <div className="text-sm font-semibold">{platform.name}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{integration?.adAccountId || "Not connected"}</div>
                        {hasAccount && !hasAdsAccess && (
                          <div className="mt-1 text-[11px] text-amber-700">
                            Connected, but Ads API access is not verified yet. Sync or reconnect if campaign import fails.
                          </div>
                        )}
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${isConnected ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                      <span className={`h-1 w-1 rounded-full ${isConnected ? "bg-emerald-500" : "bg-slate-300"}`} /> {isConnected ? "Connected" : "Disconnected"}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Spend MTD</div>
                      <div className="font-mono text-base font-semibold">{isConnected ? money(platformSpend[platform.id] || 0) : "—"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Last synced</div>
                      <div className="text-xs">{integration?.lastSynced ? new Date(integration.lastSynced).toLocaleString() : "Never"}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    {hasAccount ? (
                      <>
                        <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => setSelectAccountPlatform(platform.id)}>
                          <Building2 className="h-3.5 w-3.5" /> Switch Account
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => sync(platform.id)}><RefreshCw className="h-3 w-3" /> Sync</Button>
                        <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => disconnect(platform.id)}>Disconnect</Button>
                      </>
                    ) : (
                      <Button size="sm" className="w-full" onClick={() => setSelectAccountPlatform(platform.id)}>Connect & Select Account</Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <AdAccountSelectorDialog
          open={Boolean(selectAccountPlatform)}
          onOpenChange={(o) => !o && setSelectAccountPlatform(null)}
          platform={selectAccountPlatform || "google"}
          onAccountSelected={() => {
            load(true)
          }}
        />
      </div>
    </DashboardLayout>
  )
}
