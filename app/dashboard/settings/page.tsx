"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import {
  Bell,
  Globe,
  Settings,
  Loader2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  XCircle,
  Zap,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/Card"

// ─── Types ────────────────────────────────────────────────────────────────────

type Provider = "google"

interface IntegrationStatus {
  id: string;
  status: string; // "NOT_CONNECTED" | "OAUTH_GRANTED" | "NO_AD_ACCOUNT" | "ACCOUNT_SELECTION_REQUIRED" | "ACCOUNT_SELECTED" | "INITIAL_SYNC_RUNNING" | "ACTIVE" | "SYNC_FAILED" | "RECONNECT_REQUIRED"
  adAccountId: string | null;
  adAccountName: string | null;
  lastSynced: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  hasAdsAccess?: boolean;
  connectedAt: string;
  syncDiagnostics?: {
    accountMatch: boolean;
    importedCampaigns: number;
    providerStatus: string | null;
  };
}

interface ProviderDef {
  id: Provider
  name: string
  color: string
  bg: string
  iconSvg: React.ReactNode
  scopes: string[]
  docsUrl: string
  requiredRedirectUri?: string
}

function formatLastSynced(value: string | null) {
  if (!value) return "Pending"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "Pending"
  const elapsedMs = Date.now() - parsed.getTime()
  if (elapsedMs < 2 * 60 * 1000) return "Just now"
  return parsed.toLocaleString()
}

// ─── Provider config ──────────────────────────────────────────────────────────

const PROVIDERS: ProviderDef[] = [
  {
    id: "google",
    name: "Google Ads",
    color: "text-red-500",
    bg: "bg-red-50",
    iconSvg: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
    ),
    scopes: [
      "https://www.googleapis.com/auth/adwords",
      "openid",
      "email",
      "profile",
    ],
    docsUrl: "https://console.cloud.google.com/apis/credentials",
    requiredRedirectUri: "/api/auth/google/callback",
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null
  const messages: Record<string, string> = {
    oauth_denied: "You cancelled the authorization. Please try again.",
    invalid_state: "Security check failed. Please start the OAuth flow again.",
    no_google_config: "Please save your Google OAuth credentials first.",
    no_meta_config: "Please save your Meta OAuth credentials first.",
    token_exchange_failed: "Token exchange failed. Check your Client ID / Secret are correct.",
    decryption_error: "Internal error decrypting credentials. Contact support.",
    server_error: "An unexpected server error occurred. Please try again.",
    missing_code: "Authorization code missing from callback URL.",
    invalid_client: "Invalid Client ID or Client Secret.",
    google_discovery_failed:
      "Google Ads account discovery failed. Reconnect and verify developer token/account permissions.",
  }
  const msg = messages[error] || `OAuth error: ${error}`
  return (
    <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 font-medium mb-6 animate-in fade-in slide-in-from-top-2">
      <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-500" />
      {msg}
    </div>
  )
}

function SuccessBanner({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-xl text-sm text-green-700 font-medium mb-6 animate-in fade-in slide-in-from-top-2">
      <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-green-600" />
      {message}
    </div>
  )
}

async function readJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    return response.json()
  }

  const text = await response.text()
  throw new Error(
    text.includes("<!DOCTYPE")
      ? `Server returned HTML instead of JSON for ${response.url || "this request"}`
      : text || `Unexpected response from ${response.url || "this request"}`
  )
}

// ─── Account Selection Modal ──────────────────────────────────────────────────

function AccountSelectionModal({
  providerId,
  accounts,
  onClose,
  onSuccess
}: {
  providerId: string | null,
  accounts: any[],
  onClose: () => void,
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSelect = async (account: any) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/integrations/${providerId}/select-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ externalId: account.externalId })
      })
      if (!res.ok) throw new Error("Selection failed")
      onSuccess()
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  if (!providerId) return null

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <div>
              <h3 className="text-xl font-bold text-slate-900">Select Ad Account</h3>
              <p className="text-sm text-slate-500 mt-1">Choose the account to sync data from.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><XCircle className="w-6 h-6 text-slate-400" /></button>
        </div>

        {error && <div className="text-red-500 text-sm mb-4 bg-red-50 p-4 rounded-xl font-medium">{error}</div>}
        
        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : accounts?.length === 0 ? (
          <div className="text-slate-500 text-center py-8 font-medium bg-slate-50 rounded-2xl border border-slate-100">No linked accounts found.</div>
        ) : (
          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
            {accounts?.map(acc => (
              <button 
                key={acc.externalId} 
                onClick={() => handleSelect(acc)}
                className="w-full text-left p-4 border border-slate-200 rounded-2xl hover:border-blue-500 hover:bg-blue-50 hover:shadow-md transition-all group"
              >
                <div className="font-bold text-slate-900 group-hover:text-blue-700">{acc.name}</div>
                <div className="text-xs font-medium text-slate-400 mt-1">ID: {acc.externalId}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Per-provider card ────────────────────────────────────────────────────────

interface ProviderCardProps {
  provider: ProviderDef
  integration: IntegrationStatus | null
  onRefresh: () => void
  onSelectAccount: (providerId: Provider) => void
}

function ProviderCard({
  provider,
  integration,
  onRefresh,
  onSelectAccount,
}: ProviderCardProps) {
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const accessDeniedMessage =
    "Access Denied: Ensure you are using a Production Developer Token for real accounts, or use a Test Account for development."

  const isConnected = !!integration?.adAccountId
  const isPendingSelection = integration?.status === 'ACCOUNT_SELECTION_REQUIRED'
  const hasNoAdAccount = integration?.status === 'NO_AD_ACCOUNT'
  const isSyncFailed = integration?.status === 'SYNC_FAILED'
  const isReconnectRequired = integration?.status === 'RECONNECT_REQUIRED'
  const isAccessDenied = provider.id === "google" && integration?.lastSyncStatus === "ACCESS_DENIED"
  const isSyncing = integration?.status === 'INITIAL_SYNC_RUNNING' || connecting

  const handleSync = async () => {
    setConnecting(true)
    try {
      const res = await fetch(`/api/integrations/sync`, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: provider.id }),
      })
      const data = await readJsonResponse(res)
      if (res.ok && data?.status === "ACCESS_DENIED") {
        toast.error("Access Denied", {
          description: data?.message || accessDeniedMessage,
        })
        onRefresh?.()
      } else if (res.ok && (data?.success || data?.ok || typeof data?.campaignCount === "number")) {
        const syncedCampaigns = data?.syncedCampaigns ?? data?.campaignCount ?? 0
        toast.success("Sync successful", {
          description: `Imported ${syncedCampaigns} campaigns from ${provider.name}.`,
          className: "bg-green-50 border-green-200 text-green-800",
        })
        onRefresh?.()
      } else {
        throw new Error(data.error || "Sync failed")
      }
    } catch (err: any) {
      toast.error("Sync failed", {
        description: err.message,
      })
    } finally {
      setConnecting(false)
    }
  }

  const connect = async () => {
    if (isConnected || isPendingSelection) {
      handleSync()
      return
    }
    
    if (provider.id === 'google') {
      window.location.href = '/api/integrations/google/connect'
      return
    }
  }

  const disconnect = async () => {
    if (!confirm(`Disconnect ${provider.name}?`)) return
    setDisconnecting(true)
    try {
      const res = await fetch(`/api/integrations`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider.id })
      })
      if (!res.ok) throw new Error("Disconnect failed")
      toast.success(`${provider.name} disconnected`)
      onRefresh()
    } catch (e: any) {
      toast.error(e.message || "Failed to disconnect")
    } finally {
      setDisconnecting(false)
    }
  }

  let statusBadge = (
    <>
      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Available</span>
    </>
  )

  if (isSyncing) {
    statusBadge = (
      <>
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest">Syncing</span>
      </>
    )
  } else if (isAccessDenied) {
    statusBadge = (
      <>
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-[11px] font-bold text-red-600 uppercase tracking-widest">Access Denied</span>
      </>
    )
  } else if (isReconnectRequired) {
     statusBadge = (
      <>
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-[11px] font-bold text-red-600 uppercase tracking-widest">Reconnect</span>
      </>
    )
  } else if (isPendingSelection) {
    statusBadge = (
      <>
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-[11px] font-bold text-amber-600 uppercase tracking-widest">Select Account</span>
      </>
    )
  } else if (hasNoAdAccount) {
    statusBadge = (
      <>
        <span className="w-2 h-2 rounded-full bg-orange-500" />
        <span className="text-[11px] font-bold text-orange-600 uppercase tracking-widest">No Ads Access</span>
      </>
    )
  } else if (isConnected) {
    statusBadge = (
      <>
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest">Connected</span>
      </>
    )
  }

  return (
    <Card className="overflow-hidden flex flex-col h-full bg-white border-slate-200">
      <div className="p-6 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner bg-slate-50 border border-slate-100")}>
            {provider.iconSvg}
          </div>
          <div>
            <h4 className="font-black text-slate-900 text-[15px] uppercase tracking-tight">{provider.name}</h4>
            <div className="flex items-center gap-2 mt-1">
               {statusBadge}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6 mt-4">
        {isConnected && integration ? (
            <div className="text-[13px] text-slate-600 mb-6 space-y-2">
                <div className="flex justify-between">
                    <span className="text-slate-400">Account</span>
                    <span className="font-semibold text-slate-900">{integration.adAccountName || integration.adAccountId}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-400">Last Sync</span>
                    <span className="font-medium text-slate-700">{formatLastSynced(integration.lastSynced)}</span>
                </div>
                {isAccessDenied ? (
                   <div className="mt-2 rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">
                       <p className="font-semibold">Sync is blocked by Google Ads permissions.</p>
                       <p className="mt-1">{accessDeniedMessage}</p>
                       {integration.lastSyncError && (
                         <p className="mt-2 text-red-600">Last error: {integration.lastSyncError.substring(0, 140)}</p>
                       )}
                   </div>
                ) : isSyncFailed && (
                   <div className="mt-2 text-xs text-red-500">
                       Sync Error: {integration.lastSyncError?.substring(0, 100)}...
                    </div>
                )}
            </div>
        ) : isReconnectRequired ? (
            <div className="text-[13px] text-slate-600 mb-8 space-y-3">
              <p className="leading-relaxed">
                Google Ads account discovery failed during validation.
              </p>
              <p className="text-red-600 font-medium">
                Reconnect and verify your Google Ads developer token and sub-account permissions.
              </p>
              {integration?.lastSyncError && (
                <p className="text-xs text-slate-500">
                  Last error: {integration.lastSyncError.substring(0, 140)}
                </p>
              )}
            </div>
        ) : hasNoAdAccount ? (
            <div className="text-[13px] text-slate-600 mb-8 space-y-3">
              <p className="leading-relaxed">
                No active {provider.name} accounts found. Please connect an ad account.
              </p>
              <p className="text-orange-600 font-medium">
                Connect a user that can open at least one ads account, or grant this user ads access first.
              </p>
            </div>
        ) : (
            <p className="text-[13px] text-slate-500 leading-relaxed mb-8">
               Sync your live advertisement data and enable autonomous AI optimization for {provider.name}.
            </p>
        )}
        {provider.id === "google" && !isConnected && (
          <p className="mb-6 text-[11px] text-slate-500">
            Using a Test Developer Token? Ensure you are connecting a Google Ads Test Account.
          </p>
        )}

        {integration?.syncDiagnostics ? (
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
            <p className="font-bold uppercase tracking-wider text-slate-500">Sync diagnostics</p>
            <p className="mt-1">Provider: <span className="font-semibold text-slate-800">{integration.syncDiagnostics.providerStatus || "Unknown"}</span></p>
            <p>Account match: <span className={integration.syncDiagnostics.accountMatch ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>{integration.syncDiagnostics.accountMatch ? "OK" : "Missing mapping"}</span></p>
            <p>Imported campaigns: <span className="font-semibold text-slate-800">{integration.syncDiagnostics.importedCampaigns}</span></p>
          </div>
        ) : null}

        {isReconnectRequired ? (
           <Button
               onClick={() => window.location.href = `/api/integrations/${provider.id}/connect`}
               className="w-full h-12 bg-red-500 text-white font-black text-[13px] uppercase tracking-widest rounded-xl hover:bg-red-600 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-[0_8px_20px_-6px_rgba(239,68,68,0.4)]"
           >
               <AlertTriangle className="w-4 h-4" /> RECONNECT
           </Button>
        ) : hasNoAdAccount ? (
           <Button
               onClick={() => window.location.href = `/api/integrations/${provider.id}/connect`}
               className="w-full h-12 bg-orange-500 text-white font-black text-[13px] uppercase tracking-widest rounded-xl hover:bg-orange-600 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-[0_8px_20px_-6px_rgba(249,115,22,0.4)]"
           >
               <AlertTriangle className="w-4 h-4" /> CONNECT ADS ACCOUNT
           </Button>
        ) : isPendingSelection ? (
           <Button
               onClick={() => window.location.href = `/dashboard/settings?check_validation=${provider.id}`}
               className="w-full h-12 bg-amber-500 text-white font-black text-[13px] uppercase tracking-widest rounded-xl hover:bg-amber-600 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-[0_8px_20px_-6px_rgba(245,158,11,0.4)]"
           >
               <AlertTriangle className="w-4 h-4" /> SELECT AD ACCOUNT
           </Button>
         ) : isConnected ? (
          isAccessDenied ? (
            <div className="space-y-2">
              <Button
                onClick={() => window.location.href = `/api/integrations/${provider.id}/connect`}
                className="w-full h-11 bg-red-500 text-white font-black text-[12px] uppercase tracking-widest rounded-xl hover:bg-red-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                Reconnect
              </Button>
              <div className="flex gap-2">
                <Button
                  onClick={handleSync}
                  disabled={isSyncing || disconnecting}
                  variant="outline"
                  className="flex-1 h-11 border-slate-200 text-slate-600 font-bold text-[12px] uppercase tracking-widest rounded-xl hover:bg-slate-50"
                >
                  <RefreshCw className={cn("w-4 h-4 mr-2", isSyncing && "animate-spin")} />
                  Sync Now
                </Button>
                <Button
                  onClick={disconnect}
                  disabled={disconnecting}
                  variant="outline"
                  className="px-3 h-11 border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 rounded-xl"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Button
                  onClick={handleSync}
                  disabled={isSyncing || disconnecting}
                  variant="outline"
                  className="flex-1 h-11 border-slate-200 text-slate-600 font-bold text-[12px] uppercase tracking-widest rounded-xl hover:bg-slate-50"
                >
                  <RefreshCw className={cn("w-4 h-4 mr-2", isSyncing && "animate-spin")} />
                  Sync Now
                </Button>
                <Button
                  onClick={disconnect}
                  disabled={disconnecting}
                  variant="outline"
                  className="px-3 h-11 border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 rounded-xl"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              {provider.id === "google" && (
                <Button
                  onClick={() => onSelectAccount(provider.id)}
                  variant="outline"
                  className="mt-2 w-full h-9 border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-widest rounded-xl hover:bg-slate-50"
                >
                  Switch Ad Account
                </Button>
              )}
            </>
          )
        ) : (
          <Button
            onClick={connect}
            disabled={connecting}
            className="w-full h-12 bg-[#2563eb] text-white font-black text-[13px] uppercase tracking-widest rounded-xl hover:bg-[#1d4ed8] shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            CONNECT
          </Button>
        )}
      </div>
    </Card>
  )
}

// ─── Settings tabs ────────────────────────────────────────────────────────────

const SETTINGS_TABS = [
  {
    category: "WORKSPACE",
    items: [
      { id: "general", label: "General", icon: Settings },
      { id: "applications", label: "Integrations", icon: Globe },
      { id: "notifications", label: "Notifications", icon: Bell },
    ],
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "general")

  const [integrations, setIntegrations] = useState<Record<string, IntegrationStatus>>({})
  const [loadingConfigs, setLoadingConfigs] = useState(false)

  const oauthError = searchParams.get("error")
  
  const [showAccountModalFor, setShowAccountModalFor] = useState<string | null>(null)
  const [modalAccounts, setModalAccounts] = useState<any[]>([])
  const [validationStr, setValidationStr] = useState<string | null>(null)
  const fetchAllStateRef = useRef({ inFlight: false, lastRunAt: 0 })
  
  const checkValidationStr = searchParams.get('check_validation')

  const fetchAll = useCallback(async (force = false) => {
    const now = Date.now()
    if (fetchAllStateRef.current.inFlight) return
    if (!force && now - fetchAllStateRef.current.lastRunAt < 7000) return
    fetchAllStateRef.current.inFlight = true
    setLoadingConfigs(true)
    try {
      const intRes = await fetch("/api/integrations")
      const intData = await readJsonResponse(intRes)
      if (intData.success) setIntegrations(intData.integrations || {})
    } catch (error: any) {
      toast.error(error?.message || "Failed to load integration status")
    } finally {
      fetchAllStateRef.current.inFlight = false
      fetchAllStateRef.current.lastRunAt = Date.now()
      setLoadingConfigs(false)
    }
  }, [])

  const openAccountSelector = useCallback(async (providerId: Provider) => {
    try {
      const res = await fetch(`/api/integrations/${providerId}/accounts`)
      const data = await readJsonResponse(res)
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to load accounts")
      setModalAccounts(data.accounts || [])
      setShowAccountModalFor(providerId)
    } catch (error: any) {
      toast.error(error?.message || "Failed to load ad accounts")
    }
  }, [])

  useEffect(() => {
    if (activeTab === "applications") fetchAll(true)
  }, [activeTab, fetchAll])

  // POLLING VALIDATION LOOP FROM EXTERNAL LOGIN RETURN
  useEffect(() => {
    if (checkValidationStr && !validationStr) {
      setValidationStr(checkValidationStr)
      fetch(`/api/integrations/${checkValidationStr}/validate`, { method: 'POST' })
        .then(readJsonResponse)
        .then(data => {
          if (data.status === 'ACCOUNT_SELECTION_REQUIRED') {
             setModalAccounts(data.accounts)
             setShowAccountModalFor(checkValidationStr)
          } else if (data.status === 'ACCOUNT_SELECTED' || data.status === 'ACTIVE') {
             toast.success(`${checkValidationStr} connected successfully!`)
             fetchAll()
             // Instantly trigger sync
             fetch(`/api/integrations/sync`, {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ platform: checkValidationStr }),
             })
          } else if (data.status === 'RECONNECT_REQUIRED') {
             toast.error(
               data.message ||
               "Google Ads discovery failed. Reconnect and verify developer token/account permissions."
             )
             fetchAll()
          } else if (data.error) {
             toast.error(data.error || "Failed to validate account access")
          } else {
             toast.error(data.message || "No access.")
          }
          window.history.replaceState({}, '', '/dashboard/settings?tab=applications')
          setValidationStr(null)
          fetchAll()
        })
        .catch((e) => {
            console.error(e)
            toast.error("Validation threw a critical error")
            window.history.replaceState({}, '', '/dashboard/settings?tab=applications')
            setValidationStr(null)
        })
    }
  }, [checkValidationStr, fetchAll, validationStr])

  const renderContent = () => {
    switch (activeTab) {
      case "applications":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Platform Bridges</h2>
              <p className="text-sm text-gray-500 mt-1">
                Sync live advertisement data directly through unified native integration hooks.
              </p>
            </div>

            {/* Validation Banner */}
            {validationStr && (
              <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700 font-medium mb-6 animate-in fade-in">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                Validating your {validationStr} ad account access securely...
              </div>
            )}

            {oauthError && <ErrorBanner error={oauthError} />}

            {loadingConfigs && !validationStr ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {PROVIDERS.map(p => (
                  <ProviderCard
                    key={p.id}
                    provider={p}
                    integration={integrations[p.id] ?? null}
                    onRefresh={fetchAll}
                    onSelectAccount={openAccountSelector}
                  />
                ))}
              </div>
            )}
            
            {showAccountModalFor && (
               <AccountSelectionModal 
                 providerId={showAccountModalFor} 
                 accounts={modalAccounts}
                 onClose={() => {
                     setShowAccountModalFor(null)
                 }} 
                 onSuccess={() => {
                    setShowAccountModalFor(null)
                    toast.success("Account connected successfully!")
                    // Trigger sync immediately
                    fetch(`/api/integrations/sync`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ platform: showAccountModalFor }),
                    })
                    fetchAll()
                 }} 
               />
            )}
          </div>
        )

      case "profile":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            <Card className="p-6 bg-white">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Personal Information</h3>
              <div className="flex items-start gap-8">
                <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center text-[#1f57f5] text-2xl font-bold border-4 border-white shadow-sm shrink-0 uppercase">
                  {session?.user?.name?.[0] || session?.user?.email?.[0] || "U"}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                    <input type="text" defaultValue={session?.user?.name || ""} className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-[#1f57f5] outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Email Address</label>
                    <input type="email" defaultValue={session?.user?.email || ""} className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-[#1f57f5] outline-none" readOnly />
                  </div>
                  <div className="col-span-2">
                    <button className="btn-primary">
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )

      case "general":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            <Card className="p-6 bg-white">
              <h3 className="text-lg font-bold text-slate-900 mb-1">Workspace Settings</h3>
              <p className="text-sm text-slate-500 mb-6">Control the defaults used across your Growzzy OS workspace.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Workspace Name</label>
                  <input defaultValue="Growzzy OS Workspace" className="input h-10 text-sm" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Default Currency</label>
                  <select defaultValue="USD" className="input h-10 text-sm">
                    <option value="USD">USD - US Dollar</option>
                    <option value="INR">INR - Indian Rupee</option>
                  </select>
                </div>
              </div>
              <button className="btn btn-primary h-9 text-xs mt-6" onClick={() => toast.success("Workspace settings saved")}>
                Save Settings
              </button>
            </Card>
            <Card className="p-6 bg-white border-red-100">
              <h3 className="text-lg font-bold text-red-700 mb-1">Delete Account</h3>
              <p className="text-sm text-slate-500 mb-4">
                Permanently delete your GROWZZY OS account and associated integrations, campaigns, leads, reports, and settings.
              </p>
              <button
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
                onClick={async () => {
                  const confirmText = window.prompt("Type DELETE to permanently delete your account.")
                  if (confirmText !== "DELETE") return
                  const res = await fetch("/api/user/delete-account", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ confirm: confirmText }),
                  })
                  if (res.ok) {
                    toast.success("Account deleted")
                    window.location.href = "/auth"
                  } else {
                    const data = await res.json().catch(() => ({}))
                    toast.error(data.error || "Failed to delete account")
                  }
                }}
              >
                Delete my account
              </button>
            </Card>
          </div>
        )

      case "notifications":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            <Card className="p-6 bg-white">
              <h3 className="text-lg font-bold text-slate-900 mb-1">Alerts</h3>
              <p className="text-sm text-slate-500 mb-6">Choose which workspace alerts GROWZZY OS should surface during beta.</p>
              <div className="divide-y divide-slate-100">
                <AlertToggle title="CPA spike alert" description="Notify when CPA exceeds threshold" suffix={<><span className="text-xs text-slate-500">Threshold</span><input defaultValue="50" className="h-8 w-20 rounded-lg border border-slate-200 px-2 text-sm" /><span className="text-xs text-slate-500">USD</span></>} defaultOn />
                <AlertToggle title="Budget exhaustion" description="Notify when 90% of daily budget is spent" defaultOn />
                <AlertToggle title="Campaign paused" description="Notify when a campaign is paused manually or by automation" />
                <AlertToggle title="AI recommendations ready" description="Notify when the daily AI audit completes" defaultOn />
              </div>
            </Card>
          </div>
        )

      default:
        return (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400" />
        )
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto font-satoshi pb-20">
        <div className="flex items-end justify-between mb-8 border-b border-gray-100 pb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-500">Manage workspace preferences and integrations.</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="w-full lg:w-64 flex-shrink-0 space-y-1">
            {SETTINGS_TABS.map(group => (
              <div key={group.category} className="mb-6">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-3">{group.category}</h3>
                <div className="space-y-1">
                  {group.items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        activeTab === item.id
                          ? "bg-gray-100 text-gray-900"
                          : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                      )}
                    >
                      <item.icon className={cn("w-4 h-4", activeTab === item.id ? "text-blue-600" : "text-gray-400")} />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex-1">{renderContent()}</div>
        </div>
      </div>
    </DashboardLayout>
  )
}

function AlertToggle({ title, description, suffix, defaultOn = false }: { title: string; description: string; suffix?: React.ReactNode; defaultOn?: boolean }) {
  const [enabled, setEnabled] = useState(defaultOn)
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h4 className="font-semibold text-slate-950">{title}</h4>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <div className="flex items-center gap-3">
        {suffix}
        <button
          type="button"
          onClick={() => setEnabled((value) => !value)}
          className={cn("relative h-6 w-11 rounded-full transition", enabled ? "bg-[#1F57F5]" : "bg-slate-200")}
          aria-pressed={enabled}
        >
          <span className={cn("absolute top-1 h-4 w-4 rounded-full bg-white shadow transition", enabled ? "left-6" : "left-1")} />
        </button>
      </div>
    </div>
  )
}
