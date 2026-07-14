"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { ArrowRight, Check, ExternalLink, Loader2, Lock, ShieldCheck } from "lucide-react"

const goals = [
  { value: "SALES", label: "Sales" },
  { value: "LEADS", label: "Leads" },
  { value: "TRAFFIC", label: "Traffic" },
  { value: "APP_INSTALLS", label: "App installs" },
]

const currencies = ["USD", "INR", "EUR", "GBP", "AUD", "CAD"]

type Workspace = {
  id: string
  name: string
  websiteUrl?: string | null
  primaryGoal?: string | null
  currencyCode?: string | null
  timezone?: string | null
  dailyBudgetCeiling?: number | null
  productDescription?: string | null
}

export default function OnboardingPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [activeStep, setActiveStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [form, setForm] = useState({
    name: "Growzzy Workspace",
    websiteUrl: "",
    primaryGoal: "LEADS",
    currencyCode: "USD",
    timezone: "Asia/Calcutta",
    dailyBudgetCeiling: "5",
    productDescription: "",
  })

  const identityDone = Boolean(session?.user?.email)
  const workspaceDone = Boolean(form.name && form.primaryGoal && form.currencyCode && form.timezone && form.dailyBudgetCeiling)
  const steps = useMemo(
    () => [
      { id: 1, title: "Create your identity", done: identityDone },
      { id: 2, title: "Configure your workspace", done: workspaceDone },
      { id: 3, title: "Connect your advertising", done: googleConnected },
    ],
    [googleConnected, identityDone, workspaceDone],
  )

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [workspaceResponse, integrationResponse] = await Promise.all([
        fetch("/api/workspaces").catch(() => null),
        fetch("/api/integrations/status").catch(() => null),
      ])

      if (cancelled) return

      if (workspaceResponse?.ok) {
        const data = await workspaceResponse.json()
        const firstWorkspace = data.workspaces?.[0] as Workspace | undefined
        if (firstWorkspace) {
          setForm({
            name: firstWorkspace.name || "Growzzy Workspace",
            websiteUrl: firstWorkspace.websiteUrl || "",
            primaryGoal: firstWorkspace.primaryGoal || "LEADS",
            currencyCode: firstWorkspace.currencyCode || "USD",
            timezone: firstWorkspace.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Calcutta",
            dailyBudgetCeiling: String(firstWorkspace.dailyBudgetCeiling || 5),
            productDescription: firstWorkspace.productDescription || "",
          })
        }
      }

      if (integrationResponse?.ok) {
        const data = await integrationResponse.json()
        setGoogleConnected(Boolean(data.google?.hasAdsAccount || data.google?.hasAdsAccess))
      }

      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const saveWorkspace = async () => {
    setSaving(true)
    const response = await fetch("/api/workspaces", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        websiteUrl: form.websiteUrl,
        primaryGoal: form.primaryGoal,
        currencyCode: form.currencyCode,
        timezone: form.timezone,
        dailyBudgetCeiling: Number(form.dailyBudgetCeiling),
        productDescription: form.productDescription,
      }),
    })
    setSaving(false)
    if (!response.ok) return
    setActiveStep(3)
  }

  const finish = async () => {
    await fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingCompleted: true, onboardingStep: 3 }),
    }).catch(() => undefined)
    router.push("/dashboard/campaigns/new")
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#070707] p-4 text-white sm:p-8">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[330px_1fr]">
        <aside className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
          <div className="mb-8">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 font-black">G</div>
            <p className="text-sm text-white/60">Follow these 3 quick phases to activate your space.</p>
          </div>

          <div className="space-y-3">
            {steps.map((step) => (
              <button
                key={step.id}
                onClick={() => setActiveStep(step.id)}
                className={`flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-left transition ${
                  activeStep === step.id ? "bg-white text-black" : "bg-white/8 text-white"
                }`}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${
                  step.done ? "bg-emerald-500 text-white" : activeStep === step.id ? "bg-black text-white" : "bg-white/10 text-white/50"
                }`}>
                  {step.done ? <Check className="h-4 w-4" /> : step.id}
                </span>
                <span className="font-bold">{step.title}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="rounded-[28px] bg-white p-6 text-slate-950 shadow-2xl sm:p-8">
          {activeStep === 1 && (
            <section className="max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600">Phase 1</p>
              <h1 className="mt-3 text-3xl font-black">Create your identity</h1>
              <p className="mt-2 text-sm text-slate-500">Already completed from signup. We use this identity for workspace access and audit logs.</p>

              <div className="mt-8 rounded-2xl border border-slate-200 p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name" value={session?.user?.name || "Not set"} />
                  <Field label="Email" value={session?.user?.email || "Not set"} />
                </div>
                <div className="mt-5 flex items-center gap-2 text-sm font-bold text-emerald-600">
                  <ShieldCheck className="h-4 w-4" /> Authenticated
                </div>
              </div>

              <button onClick={() => setActiveStep(2)} className="mt-8 inline-flex items-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">
                Configure workspace <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </section>
          )}

          {activeStep === 2 && (
            <section>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600">Phase 2</p>
              <h1 className="mt-3 text-3xl font-black">Configure your workspace</h1>
              <p className="mt-2 text-sm text-slate-500">This becomes the AI context for campaign plans, budgets, and reports.</p>

              <div className="mt-8 grid gap-5 lg:grid-cols-2">
                <Input label="Business name" value={form.name} onChange={(name) => setForm((prev) => ({ ...prev, name }))} />
                <Input label="Website" value={form.websiteUrl} placeholder="https://example.com" onChange={(websiteUrl) => setForm((prev) => ({ ...prev, websiteUrl }))} />
                <Select label="Primary goal" value={form.primaryGoal} options={goals} onChange={(primaryGoal) => setForm((prev) => ({ ...prev, primaryGoal }))} />
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Currency" value={form.currencyCode} options={currencies.map((value) => ({ value, label: value }))} onChange={(currencyCode) => setForm((prev) => ({ ...prev, currencyCode }))} />
                  <Input label="Daily budget ceiling" type="number" value={form.dailyBudgetCeiling} onChange={(dailyBudgetCeiling) => setForm((prev) => ({ ...prev, dailyBudgetCeiling }))} />
                </div>
                <Input label="Timezone" value={form.timezone} onChange={(timezone) => setForm((prev) => ({ ...prev, timezone }))} />
                <label className="lg:col-span-2">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Product description</span>
                  <textarea
                    value={form.productDescription}
                    onChange={(event) => setForm((prev) => ({ ...prev, productDescription: event.target.value }))}
                    className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    placeholder="What do you sell, who is it for, and why should they care?"
                  />
                </label>
              </div>

              <button
                onClick={saveWorkspace}
                disabled={saving || !workspaceDone}
                className="mt-8 inline-flex items-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save workspace
              </button>
            </section>
          )}

          {activeStep === 3 && (
            <section>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600">Phase 3</p>
              <h1 className="mt-3 text-3xl font-black">Connect your advertising</h1>
              <p className="mt-2 text-sm text-slate-500">Google is active for this pass. Meta is visible so the journey is honest, but disabled until the Meta backend is real.</p>

              <div className="mt-8 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-2xl font-black text-blue-600">G</div>
                      <h2 className="font-black">Google Ads</h2>
                      <p className="mt-1 text-sm text-slate-500">OAuth, account selection, verification, and sync.</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${googleConnected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {googleConnected ? "Connected" : "Not connected"}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      window.location.href = "/api/integrations/google/connect"
                    }}
                    className="mt-6 inline-flex items-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white"
                  >
                    {googleConnected ? "Reconnect Google" : "Connect Google"} <ExternalLink className="ml-2 h-4 w-4" />
                  </button>
                </div>

                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-slate-500">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white">
                    <Lock className="h-5 w-5" />
                  </div>
                  <h2 className="font-black text-slate-900">Meta Ads</h2>
                  <p className="mt-1 text-sm">Planned after Google Checkpoints 1-3 pass. No fake Meta connection until the backend is live.</p>
                  <button disabled className="mt-6 rounded-xl bg-slate-200 px-5 py-3 text-sm font-bold text-slate-500">Coming after Google proof</button>
                </div>
              </div>

              <button
                onClick={finish}
                disabled={!googleConnected}
                className="mt-8 inline-flex items-center rounded-xl bg-black px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
              >
                Create your first campaign <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold">{value}</div>
    </div>
  )
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <label>
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
      />
    </label>
  )
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <label>
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
