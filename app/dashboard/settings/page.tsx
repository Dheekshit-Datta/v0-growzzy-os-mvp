"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { signOut } from "next-auth/react"
import { Shell } from "@/components/dashboard-v2/shell"
import { AlertTriangle, Check, Trash2, ChevronDown, Settings, Plug, Bell, ShieldAlert, Loader2, UserRound, Upload, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { CURATED_AVATARS } from "@/lib/profile-avatars"

type Tab = "profile" | "general" | "integrations" | "notifications" | "danger"

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "profile",       label: "Profile",       icon: UserRound   },
  { id: "general",       label: "General",       icon: Settings    },
  { id: "integrations",  label: "Integrations",  icon: Plug        },
  { id: "notifications", label: "Notifications", icon: Bell        },
  { id: "danger",        label: "Danger zone",   icon: ShieldAlert },
]

function ProfileTab() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [image, setImage] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        setImage(json?.user?.image || "")
        setName(json?.user?.name || json?.user?.email || "Growzzy user")
      })
      .finally(() => setLoading(false))
  }, [])

  const chooseUpload = (file?: File) => {
    setError("")
    if (!file) return
    if (!(["image/png", "image/jpeg", "image/webp"].includes(file.type)) || file.size > 750_000) {
      setError("Upload a PNG, JPEG, or WebP image smaller than 750 KB.")
      return
    }
    const reader = new FileReader()
    reader.onload = () => setImage(String(reader.result || ""))
    reader.readAsDataURL(file)
  }

  const save = async () => {
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Could not save profile picture")
      window.dispatchEvent(new Event("growzzy:profile-updated"))
    } catch (err: any) {
      setError(err?.message || "Could not save profile picture")
      throw err
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <SectionCard title="Profile picture" description="Choose how you appear in Growzzy."><div className="flex justify-center py-10 text-[#9CA3AF]"><Loader2 className="animate-spin" size={20} /></div></SectionCard>

  return (
    <>
    <SectionCard title="Profile picture" description="Upload your own photo or choose a Growzzy avatar.">
      <div className="flex items-center gap-4 mb-5">
        <div className="w-16 h-16 overflow-hidden rounded-full bg-[#EAF0FE] flex items-center justify-center text-[#1F57F5] text-lg font-bold ring-2 ring-white shadow-[0_1px_4px_rgba(0,0,0,0.14)]">
          {image ? <img src={image} alt={`${name} profile`} className="w-full h-full object-cover" /> : name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-[13.5px] font-semibold text-[#111827]">{name}</p>
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={() => inputRef.current?.click()} className="h-8 px-3 inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-[8px] sku-btn"><Upload size={13} /> Upload photo</button>
            {image && <button type="button" onClick={() => setImage("")} className="h-8 px-3 text-[12px] font-semibold text-[#6B7280] rounded-[8px] hover:bg-[#F0F2F5]">Remove</button>}
          </div>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => chooseUpload(e.target.files?.[0])} />
        </div>
      </div>

      <p className="text-[12.5px] font-semibold text-[#374151] mb-3">Or choose an avatar</p>
      <div className="grid grid-cols-8 gap-3">
        {CURATED_AVATARS.map((avatar, index) => (
          <button key={avatar} type="button" onClick={() => { setImage(avatar); setError("") }} className={cn("relative aspect-square overflow-hidden rounded-full transition-all", image === avatar ? "ring-2 ring-[#1F57F5] ring-offset-2" : "hover:ring-2 hover:ring-[#C7D5FD] hover:ring-offset-2")} aria-label={`Choose avatar ${index + 1}`}>
            <img src={avatar} alt="" className="w-full h-full object-cover" />
            {image === avatar && <span className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-[#1F57F5] text-white flex items-center justify-center"><Check size={10} /></span>}
          </button>
        ))}
      </div>
      {error && <p className="text-[11.5px] text-[#D3564C] mt-3">{error}</p>}
      <div className="flex justify-end mt-5"><SaveButton label="Save profile picture" onSave={save} saving={saving} /></div>
    </SectionCard>

    <SectionCard title="Account session" description="Manage your current signed-in session.">
      <div className="flex items-center justify-between py-2">
        <div>
          <p className="text-[13.5px] font-semibold text-[#111827]">Sign out of Growzzy</p>
          <p className="text-[12px] text-[#6B7280] mt-0.5">End your active session on this device.</p>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="inline-flex items-center gap-2 px-4 py-2 text-[12.5px] font-semibold text-[#D3564C] bg-[#FDF2F2] hover:bg-[#FDE8E8] border border-[#F8B4B4] rounded-[8px] transition-colors cursor-pointer"
        >
          <LogOut size={14} /> Log out
        </button>
      </div>
    </SectionCard>
    </>
  )
}

type WorkspaceData = {
  id: string
  name: string
  websiteUrl: string | null
  primaryGoal: string | null
  currencyCode: string | null
  timezone: string | null
  dailyBudgetCeiling: number | null
  productDescription: string | null
  monthlyCredits: number
  creditResetDay: number
}

function CreditUsageCard() {
  const [data, setData] = useState<{ allocatedCredits: number; usedCredits: number; remainingCredits: number; resetDate: string } | null>(null)

  useEffect(() => {
    fetch("/api/ai/credit-balance", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setData(json?.data || null))
      .catch(() => {})
  }, [])

  if (!data) return null
  const usedPercent = Math.min(100, Math.round((data.usedCredits / Math.max(1, data.allocatedCredits)) * 100))
  return (
    <div className="rounded-[10px] border border-[#DDE1E7] bg-[#F8FAFF] p-4">
      <div className="flex items-center justify-between">
        <div><p className="text-[13px] font-semibold text-[#111827]">AI credits</p><p className="text-[11.5px] text-[#6B7280]">Resets {new Date(data.resetDate).toLocaleDateString()}</p></div>
        <p className="text-[13px] font-semibold text-[#1F57F5]">{data.remainingCredits.toLocaleString()} left</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E5E7EB]"><div className="h-full rounded-full bg-[#2F61F5] transition-all" style={{ width: `${usedPercent}%` }} /></div>
      <p className="mt-2 text-[11.5px] text-[#6B7280]">{data.usedCredits.toLocaleString()} used of {data.allocatedCredits.toLocaleString()} credits</p>
    </div>
  )
}

/* ─── Controlled skeuomorphic input ─── */
function SkuInput({
  label, helper, type = "text", placeholder, prefix, value, onChange,
}: {
  label: string; helper?: string; type?: string; placeholder?: string; prefix?: string
  value: string; onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12.5px] font-semibold text-[#374151]">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#6B7280] select-none">{prefix}</span>
        )}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn("w-full h-9 pr-3 text-[13px] text-[#111827] placeholder-[#9CA3AF] outline-none rounded-[8px] sku-input", prefix ? "pl-6" : "pl-3")}
        />
      </div>
      {helper && <p className="text-[11px] text-[#9CA3AF] leading-relaxed">{helper}</p>}
    </div>
  )
}

function SkuSelect({
  label, options, value, onChange,
}: { label: string; options: { label: string; value: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12.5px] font-semibold text-[#374151]">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-9 pl-3 pr-8 text-[13px] text-[#111827] outline-none appearance-none rounded-[8px] sku-input"
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
      </div>
    </div>
  )
}

function SkuToggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  const on = checked
  return (
    <div className="flex items-start justify-between gap-4 py-3.5 border-b border-[#DDE1E7] last:border-0">
      <div>
        <p className="text-[13px] font-semibold text-[#111827]">{label}</p>
        <p className="text-[11.5px] text-[#6B7280] mt-0.5">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className="relative shrink-0 mt-0.5 rounded-full transition-all duration-200"
        style={{
          width: 40, height: 22,
          background: on
            ? 'linear-gradient(180deg, #2d65f8 0%, #1a4ee8 100%)'
            : 'linear-gradient(180deg, #d0d4da 0%, #c2c6cc 100%)',
          boxShadow: on
            ? '0 1px 0 rgba(255,255,255,0.2) inset, 0 -1px 0 rgba(0,0,0,0.15) inset, 0 1px 4px rgba(31,87,245,0.35)'
            : '0 1px 0 rgba(255,255,255,0.3) inset, 0 1px 3px rgba(0,0,0,0.12) inset',
        }}
      >
        <span
          className="absolute rounded-full bg-white transition-transform duration-200"
          style={{
            width: 18, height: 18, top: 2, left: 2,
            transform: on ? 'translateX(18px)' : 'translateX(0)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2), 0 1px 0 rgba(255,255,255,0.8) inset',
          }}
        />
      </button>
    </div>
  )
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] overflow-hidden sku-card">
      <div className="px-6 py-4 border-b border-[#DDE1E7]">
        <p className="text-[14.5px] font-semibold text-[#111827]">{title}</p>
        {description && <p className="text-[12px] text-[#6B7280] mt-0.5">{description}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

function SaveButton({ label = "Save changes", onSave, saving }: { label?: string; onSave: () => void; saving?: boolean }) {
  const [saved, setSaved] = useState(false)
  const handleSave = async () => {
    await onSave()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }
  return (
    <button
      onClick={handleSave}
      disabled={saving}
      className="flex items-center gap-1.5 h-9 px-5 text-white text-[13px] font-semibold rounded-[8px] sku-btn-primary transition-all disabled:opacity-60"
    >
      {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : saved ? <><Check size={13} /> Saved!</> : <><Check size={13} /> {label}</>}
    </button>
  )
}

/* ── Status pill used on integration cards ── */
function StatusPill({ status }: { status: "connected" | "disconnected" | "coming-soon" }) {
  if (status === "connected")
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2E9E5B] bg-[#E6F4EC] px-2 py-0.5 rounded-full">Connected</span>
  if (status === "coming-soon")
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B7280] bg-[#E0E2E6] px-2 py-0.5 rounded-full">Coming soon</span>
  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#B8892B] bg-[#FBF0DA] px-2 py-0.5 rounded-full">Not connected</span>
}

const GOAL_OPTIONS = [
  { label: "Select a goal", value: "" },
  { label: "Sales", value: "SALES" },
  { label: "Leads", value: "LEADS" },
  { label: "App installs", value: "APP_INSTALLS" },
  { label: "Website traffic", value: "TRAFFIC" },
]
const CURRENCY_OPTIONS = [
  { label: "Select currency", value: "" },
  { label: "USD ($)", value: "USD" },
  { label: "INR (₹)", value: "INR" },
  { label: "EUR (€)", value: "EUR" },
  { label: "GBP (£)", value: "GBP" },
  { label: "AUD (A$)", value: "AUD" },
]
const TIMEZONE_OPTIONS = [
  { label: "Select timezone", value: "" },
  { label: "UTC-5 (Eastern)", value: "America/New_York" },
  { label: "UTC-8 (Pacific)", value: "America/Los_Angeles" },
  { label: "UTC+5:30 (IST)", value: "Asia/Kolkata" },
  { label: "UTC+0 (GMT)", value: "Etc/UTC" },
  { label: "UTC+1 (CET)", value: "Europe/Paris" },
]

function GeneralTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ws, setWs] = useState<Partial<WorkspaceData>>({})

  useEffect(() => {
    fetch("/api/workspaces", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const w = json?.workspaces?.[0]
        if (w) setWs(w)
      })
      .finally(() => setLoading(false))
  }, [])

  const set = (patch: Partial<WorkspaceData>) => setWs((prev) => ({ ...prev, ...patch }))

  const save = async () => {
    setSaving(true)
    try {
      await fetch("/api/workspaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: ws.name || undefined,
          websiteUrl: ws.websiteUrl || "",
          primaryGoal: ws.primaryGoal || undefined,
          currencyCode: ws.currencyCode || undefined,
          timezone: ws.timezone || undefined,
          dailyBudgetCeiling: ws.dailyBudgetCeiling ?? undefined,
          productDescription: ws.productDescription || "",
          monthlyCredits: ws.monthlyCredits ?? undefined,
          creditResetDay: ws.creditResetDay ?? undefined,
        }),
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <SectionCard title="Workspace" description="Configure your workspace identity and AI context.">
      <div className="flex items-center justify-center py-10 text-[#9CA3AF]"><Loader2 className="animate-spin" size={20} /></div>
    </SectionCard>
  }

  return (
    <SectionCard title="Workspace" description="Configure your workspace identity and AI context.">
      <div className="grid grid-cols-2 gap-4">
        <SkuInput label="Workspace name" placeholder="Your workspace name" value={ws.name || ""} onChange={(v) => set({ name: v })} />
        <SkuInput label="Business website" type="url" placeholder="https://yourwebsite.com" value={ws.websiteUrl || ""} onChange={(v) => set({ websiteUrl: v })} />
        <SkuSelect label="Primary goal" options={GOAL_OPTIONS} value={ws.primaryGoal || ""} onChange={(v) => set({ primaryGoal: v })} />
        <SkuSelect label="Currency" options={CURRENCY_OPTIONS} value={ws.currencyCode || ""} onChange={(v) => set({ currencyCode: v })} />
        <SkuSelect label="Timezone" options={TIMEZONE_OPTIONS} value={ws.timezone || ""} onChange={(v) => set({ timezone: v })} />
        <SkuInput
          label="Daily budget ceiling"
          type="number"
          placeholder="0.00"
          prefix="$"
          helper="AI can never exceed this amount per day — enforced automatically."
          value={ws.dailyBudgetCeiling != null ? String(ws.dailyBudgetCeiling) : ""}
          onChange={(v) => set({ dailyBudgetCeiling: v ? Number(v) : null })}
        />
        <SkuInput label="Monthly AI credits" type="number" placeholder="1000" helper="Shared by this workspace for AI features." value={ws.monthlyCredits != null ? String(ws.monthlyCredits) : ""} onChange={(v) => set({ monthlyCredits: v ? Number(v) : 0 })} />
        <SkuInput label="Credit reset day" type="number" placeholder="1" helper="Day of month from 1 to 31." value={ws.creditResetDay != null ? String(ws.creditResetDay) : "1"} onChange={(v) => set({ creditResetDay: v ? Number(v) : 1 })} />
        <div className="col-span-2 space-y-1.5">
          <label className="block text-[12.5px] font-semibold text-[#374151]">Product description</label>
          <textarea
            rows={4}
            placeholder="Describe your product, ideal customer, and what makes you different..."
            value={ws.productDescription || ""}
            onChange={(e) => set({ productDescription: e.target.value })}
            className="w-full px-3 py-2.5 text-[13px] text-[#111827] placeholder-[#9CA3AF] outline-none resize-none leading-relaxed rounded-[8px] sku-input"
          />
          <p className="text-[11px] text-[#9CA3AF]">Used by the AI to write your campaigns. Be specific.</p>
        </div>
      </div>
      <div className="flex justify-end mt-5">
        <SaveButton onSave={save} saving={saving} />
      </div>
      <div className="mt-5 border-t border-[#DDE1E7] pt-5"><CreditUsageCard /></div>
    </SectionCard>
  )
}

function IntegrationsTab() {
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [google, setGoogle] = useState<{
    connected: boolean
    accountName?: string | null
    selectedAdAccountId?: string | null
    selectedAdAccountName?: string | null
    adAccounts?: Array<{ id: string; externalId: string; name: string; isPrimary?: boolean }>
  } | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch("/api/integrations/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setGoogle(json?.google ?? null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSelectAccount = async (externalId: string) => {
    if (!externalId || switching) return
    setSwitching(true)
    try {
      await fetch("/api/integrations/google/select-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ externalId }),
      })
      load()
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="space-y-5">
      <SectionCard title="Ad Platforms" description="Connect your advertising accounts to pull in live data and launch campaigns.">
        <div className="space-y-3">
          {/* Google Ads */}
          <div className="p-4 rounded-[10px] sku-inset space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center sku-btn">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[13.5px] font-semibold text-[#111827]">Google Ads</p>
                    {loading ? <Loader2 size={12} className="animate-spin text-[#9CA3AF]" /> : <StatusPill status={google?.connected ? "connected" : "disconnected"} />}
                  </div>
                  <p className="text-[12px] text-[#9CA3AF]">
                    {google?.connected
                      ? (google.accountName || google.selectedAdAccountName || "Connected to Google")
                      : "Connect to launch campaigns and see live data"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {google?.connected ? (
                  <a
                    href={`/api/integrations/google/connect?returnTo=${encodeURIComponent('/dashboard/settings?tab=integrations')}`}
                    className="flex items-center gap-1.5 h-8 px-3 text-[#374151] text-[12px] font-medium rounded-[8px] sku-btn hover:bg-white"
                  >
                    Reconnect Account
                  </a>
                ) : (
                  <a
                    href={`/api/integrations/google/connect?returnTo=${encodeURIComponent('/dashboard/settings?tab=integrations')}`}
                    className="flex items-center gap-1.5 h-8 px-4 text-white text-[12.5px] font-semibold rounded-[8px] sku-btn-primary"
                  >
                    Connect
                  </a>
                )}
              </div>
            </div>

            {/* Account Switcher Dropdown for Google Ads (Multi-Account Support) */}
            {google?.connected && (
              <div className="pt-3 border-t border-[#DDE1E7] flex items-center justify-between gap-4">
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151]">Active Ad Account</label>
                  <p className="text-[11px] text-[#6B7280]">Select which customer account this workspace publishes campaigns to.</p>
                </div>
                <div className="w-[280px] relative">
                  <select
                    disabled={switching}
                    value={google.selectedAdAccountId || google.adAccounts?.[0]?.externalId || ""}
                    onChange={(e) => handleSelectAccount(e.target.value)}
                    className="w-full h-8 pl-3 pr-8 text-[12px] text-[#111827] outline-none appearance-none rounded-[6px] sku-input bg-white font-medium"
                  >
                    {google.adAccounts && google.adAccounts.length > 0 ? (
                      google.adAccounts.map((acc) => (
                        <option key={acc.externalId} value={acc.externalId}>
                          {acc.name || `Account ${acc.externalId}`} ({acc.externalId})
                        </option>
                      ))
                    ) : (
                      <option value="">Default Google Account ({google.selectedAdAccountId || "Connected"})</option>
                    )}
                  </select>
                  {switching ? (
                    <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1F57F5] animate-spin" />
                  ) : (
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Meta Ads — disabled */}
          <div className="flex items-center justify-between p-4 rounded-[10px] opacity-55" style={{ background: '#F4F5F7' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: '#fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.07)' }}>
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#1877F2">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[13.5px] font-semibold text-[#374151]">Meta Ads</p>
                  <StatusPill status="coming-soon" />
                </div>
                <p className="text-[12px] text-[#9CA3AF]">Meta Ads support is on the way — Google Ads is fully supported today.</p>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

const NOTIFICATION_DEFAULTS = {
  weeklyDigest: true,
  optimizationAlerts: true,
  budgetAlerts: true,
  productUpdates: false,
}
type NotificationPrefs = typeof NOTIFICATION_DEFAULTS

function NotificationsTab() {
  const [loading, setLoading] = useState(true)
  const [prefs, setPrefs] = useState<NotificationPrefs>(NOTIFICATION_DEFAULTS)

  useEffect(() => {
    fetch("/api/user/settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const saved = json?.settings?.notificationPrefs
        if (saved && typeof saved === "object") setPrefs({ ...NOTIFICATION_DEFAULTS, ...saved })
      })
      .finally(() => setLoading(false))
  }, [])

  const update = (patch: Partial<NotificationPrefs>) => {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    fetch("/api/user/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationPrefs: next }),
    }).catch(() => {})
  }

  if (loading) {
    return <SectionCard title="In-app notifications" description="Choose what appears in your Growzzy notification feed.">
      <div className="flex items-center justify-center py-10 text-[#9CA3AF]"><Loader2 className="animate-spin" size={20} /></div>
    </SectionCard>
  }

  return (
    <SectionCard title="In-app notifications" description="Choose what appears in your Growzzy notification feed.">
      <div>
        <SkuToggle label="Weekly performance digest" description="Show a summary of spend, results, and AI actions every Monday" checked={prefs.weeklyDigest} onChange={(v) => update({ weeklyDigest: v })} />
        <SkuToggle label="Optimization alerts" description="Notify when AI flags something that needs your attention" checked={prefs.optimizationAlerts} onChange={(v) => update({ optimizationAlerts: v })} />
        <SkuToggle label="Budget alerts" description="Notify if a campaign is on track to hit your daily budget ceiling" checked={prefs.budgetAlerts} onChange={(v) => update({ budgetAlerts: v })} />
        <SkuToggle label="Product updates" description="Occasional announcements about new features — off by default" checked={prefs.productUpdates} onChange={(v) => update({ productUpdates: v })} />
      </div>
      <p className="text-[11px] text-[#9CA3AF] mt-4 pt-4 border-t border-[#DDE1E7]">
        These alerts are in-app only. Email delivery is not enabled in this environment.
      </p>
    </SectionCard>
  )
}

function DangerTab() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [input, setInput] = useState("")
  const CONFIRM_PHRASE = "delete my account"

  const doDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch("/api/user/delete-account", { method: "DELETE" })
      if (res.ok) {
        setConfirmed(true)
        setTimeout(() => { window.location.href = "/" }, 1800)
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      className="rounded-[14px] overflow-hidden border-2 border-[#D3564C]/25"
      style={{
        background: 'linear-gradient(145deg, #ffffff 0%, #fff8f7 100%)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 2px 8px rgba(211,86,76,0.08)',
      }}
    >
      <div className="px-6 py-4 border-b border-[#D3564C]/20 flex items-center gap-2">
        <AlertTriangle size={14} className="text-[#D3564C]" />
        <p className="text-[14.5px] font-semibold text-[#111827]">Danger zone</p>
      </div>
      <div className="px-6 py-5 space-y-5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-[13px] font-semibold text-[#111827]">Delete account</p>
            <p className="text-[12px] text-[#6B7280] mt-0.5 max-w-[440px]">
              Permanently deletes your account, all campaigns, integrations, and data. This cannot be undone.
            </p>
          </div>
          {!confirmOpen && (
            <button
              onClick={() => setConfirmOpen(true)}
              className="flex items-center gap-1.5 h-9 px-4 border-2 border-[#D3564C] text-[#D3564C] text-[12.5px] font-semibold rounded-[8px] hover:bg-[#FBE7E5] transition-colors shrink-0"
            >
              <Trash2 size={13} />
              Delete account
            </button>
          )}
        </div>
        {confirmOpen && !confirmed && (
          <div className="rounded-[10px] border border-[#D3564C]/30 bg-[#FBE7E5]/50 p-4 space-y-3">
            <p className="text-[12.5px] font-semibold text-[#D3564C]">
              Type <span className="font-bold">&quot;{CONFIRM_PHRASE}&quot;</span> to confirm
            </p>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              className="w-full h-9 px-3 text-[13px] text-[#111827] placeholder-[#9CA3AF] outline-none rounded-[8px] sku-input"
            />
            <div className="flex gap-2">
              <button
                onClick={doDelete}
                disabled={input !== CONFIRM_PHRASE || deleting}
                className={cn(
                  "flex items-center gap-1.5 h-9 px-4 text-[12.5px] font-semibold rounded-[8px] transition-colors",
                  input === CONFIRM_PHRASE && !deleting
                    ? "bg-[#D3564C] text-white hover:bg-[#b84540]"
                    : "bg-[#E9EBEF] text-[#9CA3AF] cursor-not-allowed"
                )}
              >
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Confirm delete
              </button>
              <button
                onClick={() => { setConfirmOpen(false); setInput("") }}
                className="h-9 px-4 text-[12.5px] font-semibold text-[#374151] rounded-[8px] sku-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {confirmed && (
          <div className="rounded-[10px] border border-[#2E9E5B]/30 bg-[#E6F4EC] p-4">
            <p className="text-[12.5px] font-semibold text-[#2E9E5B]">Account deleted. Redirecting…</p>
          </div>
        )}
      </div>
    </div>
  )
}

const VALID_TABS: Tab[] = ["profile", "general", "integrations", "notifications", "danger"]

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<Tab>("general")

  useEffect(() => {
    const requested = searchParams.get("tab")
    if (requested && (VALID_TABS as string[]).includes(requested)) {
      setActiveTab(requested as Tab)
    }
  }, [searchParams])

  const CONTENT: Record<Tab, React.ReactNode> = {
    profile:       <ProfileTab />,
    general:       <GeneralTab />,
    integrations:  <IntegrationsTab />,
    notifications: <NotificationsTab />,
    danger:        <DangerTab />,
  }

  const TAB_DESCRIPTIONS: Record<Tab, string> = {
    profile:       "Choose how your account appears across Growzzy.",
    general:       "Configure your workspace identity and AI context.",
    integrations:  "Connect your ad platforms to start running campaigns.",
    notifications: "Control which emails Growzzy sends you.",
    danger:        "Irreversible actions — proceed with caution.",
  }

  return (
    <Shell title="Settings">
      <div className="flex h-full">
        {/* Left sub-nav */}
        <div
          className="w-[196px] shrink-0 border-r border-[#DDE1E7] pt-4 px-2"
          style={{ background: 'linear-gradient(180deg, #fafbfc 0%, #f5f6f8 100%)' }}
        >
          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-[0.1em] px-2 mb-1.5">Account</p>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "w-full text-left flex items-center gap-2.5 px-2 py-2 rounded-[8px] text-[13px] mb-0.5 transition-colors",
                activeTab === id
                  ? "bg-[#EAF0FE] text-[#1F57F5] font-semibold shadow-[0_1px_3px_rgba(31,87,245,0.12)]"
                  : id === "danger"
                    ? "text-[#D3564C] font-medium hover:bg-[#FBE7E5]"
                    : "text-[#4B5563] font-medium hover:bg-white/80"
              )}
            >
              <Icon size={14} className="shrink-0" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-[700px] space-y-5">
            <div>
              <h2 className="text-[20px] text-[#111827] leading-tight" style={{ fontWeight: 500 }}>
                {TABS.find((t) => t.id === activeTab)?.label}
              </h2>
              <p className="text-[12.5px] text-[#6B7280] mt-0.5">{TAB_DESCRIPTIONS[activeTab]}</p>
            </div>
            {CONTENT[activeTab]}
          </div>
        </div>
      </div>
    </Shell>
  )
}
