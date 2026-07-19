"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { ConversationalWorkspace, type WorkspaceAnswers } from "@/components/onboarding/conversational-workspace"

type Step = 2 | 3
type OnboardingState = {
  currentStep: Step
  identity: { name: string; email: string }
  workspace: WorkspaceAnswers
  google: { connected: boolean; accountId: string }
}

const DEFAULT_STATE: OnboardingState = {
  currentStep: 2,
  identity: { name: "Growzzy user", email: "" },
  workspace: {
    businessName: "",
    websiteUrl: "",
    productDescription: "",
    idealCustomer: "",
    differentiator: "",
    marketingHistory: "",
    tone: "Professional",
    primaryGoal: "LEADS",
    currency: "USD",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Etc/UTC",
    dailyBudget: "10",
  },
  google: { connected: false, accountId: "" },
}

export default function OnboardingPage() {
  const router = useRouter()
  const [state, setState] = useState(DEFAULT_STATE)
  const [mounted, setMounted] = useState(false)
  const [storageKey, setStorageKey] = useState("growzzy_onboarding")

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/integrations/status", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
    ]).then(([profile, integrations]) => {
      const user = profile?.user
      const key = user?.email ? `growzzy_onboarding_${user.email}` : "growzzy_onboarding"
      setStorageKey(key)
      let restored: OnboardingState | null = null
      try { restored = JSON.parse(localStorage.getItem(key) || "null") } catch {}
      const google = integrations?.google
      setState((current) => ({
        ...current,
        ...(restored || {}),
        currentStep: google?.connected ? 3 : (restored?.currentStep || 2),
        identity: { name: user?.name || user?.email || current.identity.name, email: user?.email || "" },
        workspace: { ...current.workspace, ...(restored?.workspace || {}) },
        google: { connected: Boolean(google?.connected), accountId: google?.selectedAdAccountId || google?.accountId || "" },
      }))
    }).finally(() => setMounted(true))
  }, [])

  useEffect(() => {
    if (mounted) localStorage.setItem(storageKey, JSON.stringify(state))
  }, [mounted, state, storageKey])

  const saveWorkspace = async (summary: string) => {
    const w = state.workspace
    const res = await fetch("/api/workspaces", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: w.businessName.trim(),
        websiteUrl: w.websiteUrl.trim(),
        primaryGoal: w.primaryGoal,
        currencyCode: w.currency,
        timezone: w.timezone,
        dailyBudgetCeiling: Number(w.dailyBudget),
        productDescription: summary,
        toneOfVoice: w.tone,
      }),
    })
    if (!res.ok) throw new Error("Could not save workspace context")
    await fetch("/api/onboarding", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ onboardingStep: 2 }) })
    setState((s) => ({ ...s, currentStep: 3, workspace: { ...s.workspace, productDescription: summary } }))
    window.dispatchEvent(new Event("growzzy:workspace-updated"))
  }

  const complete = async (destination: string) => {
    await fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingCompleted: true, onboardingStep: 3 }),
    })
    localStorage.removeItem(storageKey)
    router.push(destination)
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-[#F6F7F9] px-4 py-8">
      <div className="mx-auto w-full max-w-[720px]">
        <div className="mb-8 text-center">
          <div className="mb-3 flex items-center justify-center gap-2"><Image src="/growzzy-logo.png" alt="Growzzy" width={32} height={32} /><p className="text-[20px] font-bold text-[#111827]">Growzzy OS</p></div>
          <p className="text-[13px] text-[#6B7280]">Tell Growzzy enough to make its first campaign feel like yours.</p>
        </div>

        <div className="space-y-3">
          <Phase number={1} title="Create your identity" complete>
            <p className="text-[11.5px] text-[#6B7280]">{state.identity.name} · {state.identity.email} · Authenticated</p>
          </Phase>

          <Phase number={2} title="Configure your workspace" active={state.currentStep === 2} complete={state.currentStep > 2}>
            {state.currentStep === 2 && <ConversationalWorkspace value={state.workspace} onChange={(patch) => setState((s) => ({ ...s, workspace: { ...s.workspace, ...patch } }))} onComplete={saveWorkspace} />}
          </Phase>

          <Phase number={3} title="Connect your advertising" active={state.currentStep === 3}>
            {state.currentStep === 3 && (
              <div className="space-y-4 p-5">
                <div className="sku-card flex items-center justify-between p-4">
                  <div><p className="text-[13.5px] font-semibold text-[#111827]">Google Ads</p><p className="mt-0.5 text-[11.5px] text-[#6B7280]">{state.google.connected ? `Connected account ${state.google.accountId}` : "Connect, choose an account, and begin the first real sync."}</p></div>
                  {state.google.connected ? <span className="inline-flex items-center gap-1 rounded-full bg-[#E6F4EC] px-2 py-1 text-[11px] font-semibold text-[#2E9E5B]"><Check size={11} /> Connected</span> : <a href="/api/integrations/google/connect?returnTo=/dashboard/onboarding" className="sku-btn-primary rounded-[8px] px-4 py-2 text-[12px] font-semibold text-white">Connect Google</a>}
                </div>
                <div className="sku-card flex items-center justify-between p-4 opacity-60"><div><p className="text-[13.5px] font-semibold text-[#374151]">Meta Ads</p><p className="mt-0.5 text-[11.5px] text-[#9CA3AF]">Visible now; enabled only when the real Meta backend ships.</p></div><span className="rounded-full bg-[#E5E7EB] px-2 py-1 text-[11px] font-semibold text-[#6B7280]">Planned</span></div>
                <div className="flex gap-3">
                  <button onClick={() => setState((s) => ({ ...s, currentStep: 2 }))} className="sku-btn h-10 flex-1 rounded-[8px] text-[13px] font-semibold">Back</button>
                  <button disabled={!state.google.connected} onClick={() => complete("/dashboard/campaigns/new")} className="sku-btn-primary h-10 flex-1 rounded-[8px] text-[13px] font-semibold text-white disabled:opacity-40">Create your first campaign</button>
                </div>
                <button onClick={() => complete("/dashboard")} className="w-full text-[12px] font-semibold text-[#1F57F5]">I&apos;ll connect later</button>
              </div>
            )}
          </Phase>
        </div>
      </div>
    </div>
  )
}

function Phase({ number, title, active, complete, children }: { number: number; title: string; active?: boolean; complete?: boolean; children: React.ReactNode }) {
  return <div className={cn("overflow-hidden rounded-[14px] sku-card", active && "ring-2 ring-[#1F57F5]")}>
    <div className="flex items-center gap-3 border-b border-[#DDE1E7] p-4">
      <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold", active || complete ? "bg-[#1F57F5] text-white" : "bg-[#E5E7EB] text-[#9CA3AF]")}>{complete ? <Check size={14} /> : number}</span>
      <p className={cn("text-[13.5px] font-semibold", active || complete ? "text-[#111827]" : "text-[#9CA3AF]")}>{title}</p>
    </div>
    {complete && !active ? <div className="px-4 py-3">{children}</div> : children}
  </div>
}
