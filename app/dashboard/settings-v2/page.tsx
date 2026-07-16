"use client"

import { useState } from "react"
import { Shell } from "@/components/shell"
import { AlertTriangle, Check, Trash2, ChevronDown, Settings, Plug, Bell, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"

type Tab = "general" | "integrations" | "notifications" | "danger"

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "general",       label: "General",       icon: Settings    },
  { id: "integrations",  label: "Integrations",  icon: Plug        },
  { id: "notifications", label: "Notifications", icon: Bell        },
  { id: "danger",        label: "Danger zone",   icon: ShieldAlert },
]

/* ─── Skeuomorphic input ─── */
function SkuInput({
  label, helper, type = "text", placeholder, prefix,
}: {
  label: string; helper?: string; type?: string; placeholder?: string; prefix?: string
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
          className={cn("w-full h-9 pr-3 text-[13px] text-[#111827] placeholder-[#9CA3AF] outline-none rounded-[8px] sku-input", prefix ? "pl-6" : "pl-3")}
        />
      </div>
      {helper && <p className="text-[11px] text-[#9CA3AF] leading-relaxed">{helper}</p>}
    </div>
  )
}

function SkuSelect({ label, options }: { label: string; options: string[] }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12.5px] font-semibold text-[#374151]">{label}</label>
      <div className="relative">
        <select
          className="w-full h-9 pl-3 pr-8 text-[13px] text-[#111827] outline-none appearance-none rounded-[8px] sku-input"
        >
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
        <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
      </div>
    </div>
  )
}

function SkuToggle({ label, description, defaultChecked }: { label: string; description: string; defaultChecked?: boolean }) {
  const [on, setOn] = useState(defaultChecked ?? false)
  return (
    <div className="flex items-start justify-between gap-4 py-3.5 border-b border-[#DDE1E7] last:border-0">
      <div>
        <p className="text-[13px] font-semibold text-[#111827]">{label}</p>
        <p className="text-[11.5px] text-[#6B7280] mt-0.5">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={on}
        onClick={() => setOn(!on)}
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

function SaveButton({ label = "Save changes" }: { label?: string }) {
  const [saved, setSaved] = useState(false)
  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  return (
    <button
      onClick={handleSave}
      className="flex items-center gap-1.5 h-9 px-5 text-white text-[13px] font-semibold rounded-[8px] sku-btn-primary transition-all"
    >
      {saved ? <><Check size={13} /> Saved!</> : <><Check size={13} /> {label}</>}
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

function GeneralTab() {
  return (
    <SectionCard title="Workspace" description="Configure your workspace identity and AI context.">
      <div className="grid grid-cols-2 gap-4">
        <SkuInput label="Workspace name" placeholder="Your workspace name" />
        <SkuInput label="Business website" type="url" placeholder="https://yourwebsite.com" />
        <SkuSelect label="Primary goal" options={["Select a goal", "Sales", "Leads", "App installs", "Website traffic"]} />
        <SkuSelect label="Currency" options={["Select currency", "USD ($)", "INR (₹)", "EUR (€)", "GBP (£)", "AUD (A$)"]} />
        <SkuSelect label="Timezone" options={["Select timezone", "UTC-5 (Eastern)", "UTC-8 (Pacific)", "UTC+5:30 (IST)", "UTC+0 (GMT)", "UTC+1 (CET)"]} />
        <SkuInput
          label="Daily budget ceiling"
          type="number"
          placeholder="0.00"
          prefix="$"
          helper="AI can never exceed this amount per day — enforced automatically."
        />
        <div className="col-span-2 space-y-1.5">
          <label className="block text-[12.5px] font-semibold text-[#374151]">Product description</label>
          <textarea
            rows={4}
            placeholder="Describe your product, ideal customer, and what makes you different..."
            className="w-full px-3 py-2.5 text-[13px] text-[#111827] placeholder-[#9CA3AF] outline-none resize-none leading-relaxed rounded-[8px] sku-input"
          />
          <p className="text-[11px] text-[#9CA3AF]">Used by the AI to write your campaigns. Be specific.</p>
        </div>
      </div>
      <div className="flex justify-end mt-5">
        <SaveButton />
      </div>
    </SectionCard>
  )
}

function IntegrationsTab() {
  return (
    <div className="space-y-5">
      <SectionCard title="Ad Platforms" description="Connect your advertising accounts to pull in live data and launch campaigns.">
        <div className="space-y-3">
          {/* Google Ads */}
          <div className="flex items-center justify-between p-4 rounded-[10px] sku-inset">
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
                  <StatusPill status="disconnected" />
                </div>
                <p className="text-[12px] text-[#9CA3AF]">Connect to launch campaigns and see live data</p>
              </div>
            </div>
            <button className="flex items-center gap-1.5 h-8 px-4 text-white text-[12.5px] font-semibold rounded-[8px] sku-btn-primary">
              Connect
            </button>
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

function NotificationsTab() {
  return (
    <SectionCard title="Email notifications" description="Choose what Growzzy emails you about.">
      <div>
        <SkuToggle label="Weekly performance digest" description="Email summary of spend, results, and AI actions every Monday" defaultChecked />
        <SkuToggle label="Optimization alerts" description="Email when AI flags something that needs your attention" defaultChecked />
        <SkuToggle label="Budget alerts" description="Email if a campaign is on track to hit your daily budget ceiling" defaultChecked />
        <SkuToggle label="Product updates" description="Occasional announcements about new features — off by default" />
      </div>
      <div className="flex justify-end mt-5 pt-4 border-t border-[#DDE1E7]">
        <SaveButton label="Save preferences" />
      </div>
    </SectionCard>
  )
}

function DangerTab() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [input, setInput] = useState("")
  const CONFIRM_PHRASE = "delete my account"

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
                onClick={() => { if (input === CONFIRM_PHRASE) setConfirmed(true) }}
                disabled={input !== CONFIRM_PHRASE}
                className={cn(
                  "flex items-center gap-1.5 h-9 px-4 text-[12.5px] font-semibold rounded-[8px] transition-colors",
                  input === CONFIRM_PHRASE
                    ? "bg-[#D3564C] text-white hover:bg-[#b84540]"
                    : "bg-[#E9EBEF] text-[#9CA3AF] cursor-not-allowed"
                )}
              >
                <Trash2 size={13} />
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
            <p className="text-[12.5px] font-semibold text-[#2E9E5B]">Account deletion scheduled. You will receive a confirmation email.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("general")

  const CONTENT: Record<Tab, React.ReactNode> = {
    general:       <GeneralTab />,
    integrations:  <IntegrationsTab />,
    notifications: <NotificationsTab />,
    danger:        <DangerTab />,
  }

  const TAB_DESCRIPTIONS: Record<Tab, string> = {
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
